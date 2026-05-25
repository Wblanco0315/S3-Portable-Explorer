import { S3Client, ListBucketsCommand, ListObjectsV2Command, GetBucketLocationCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { useDownloadStore } from "../downloads/downloadStore";

// We will store the client instance in memory after login
let s3ClientInstance: S3Client | null = null;

// Store the absolute original native fetch once
if (!(window as any).__originalFetch) {
  (window as any).__originalFetch = window.fetch;
}

// Override the global fetch with Tauri's fetch to bypass CORS, but ONLY for AWS URLs.
// We overwrite window.fetch every time to ensure Vite HMR updates the logic instantly.
window.fetch = async (input, init) => {
  let urlStr = '';
  if (typeof input === 'string') {
    urlStr = input;
  } else if (input instanceof URL) {
    urlStr = input.toString();
  } else if (input instanceof Request) {
    urlStr = input.url;
  }

  // Only intercept AWS S3 requests to bypass CORS via Tauri Rust backend
  if (urlStr.includes('amazonaws.com')) {
    let newInit: any = { ...init };
    const customHeaders = new Headers();

    if (input instanceof Request) {
      newInit.method = input.method;

      // AWS SDK requests might have streaming bodies which fail in Tauri's fetch wrapper.
      // Reading the body as an ArrayBuffer resolves the duplex stream issue natively.
      if (init?.body) {
        newInit.body = init.body;
      } else if (input.body) {
        newInit.body = await input.clone().arrayBuffer();
      }

      const headers = new Headers(input.headers);
      if (init?.headers) {
        new Headers(init.headers).forEach((v, k) => headers.set(k, v));
      }
      headers.forEach((v, k) => {
        const lowerKey = k.toLowerCase();
        if (
          lowerKey !== 'host' &&
          lowerKey !== 'origin' &&
          lowerKey !== 'referer' &&
          !lowerKey.startsWith('sec-')
        ) {
          customHeaders.set(k, v);
        }
      });
    } else {
      if (newInit.headers) {
        const headers = new Headers(newInit.headers);
        headers.forEach((v, k) => {
          const lowerKey = k.toLowerCase();
          if (
            lowerKey !== 'host' &&
            lowerKey !== 'origin' &&
            lowerKey !== 'referer' &&
            !lowerKey.startsWith('sec-')
          ) {
            customHeaders.set(k, v);
          }
        });
      }
    }

    // Override standard methods on customHeaders to bypass Tauri's auto-append of local origin:
    // 1. Prevent Tauri's JS wrapper from adding 'http://localhost:1420' by pretending we already have 'Origin'.
    // 2. Omit 'Origin' entirely from the actual serialized entries passed to Rust's native fetch.
    const customHeadersAny = customHeaders as any;
    const originalGet = customHeaders.get.bind(customHeaders);
    customHeadersAny.get = (name: string) => {
      if (name.toLowerCase() === 'origin') {
        return 'dummy-prevent-auto-append';
      }
      return originalGet(name);
    };

    const originalHas = customHeaders.has.bind(customHeaders);
    customHeadersAny.has = (name: string) => {
      if (name.toLowerCase() === 'origin') {
        return true;
      }
      return originalHas(name);
    };

    const originalEntries = customHeaders.entries.bind(customHeaders);
    customHeadersAny.entries = function* () {
      for (const [k, v] of originalEntries()) {
        if (k.toLowerCase() !== 'origin') {
          yield [k, v];
        }
      }
    };

    customHeadersAny[Symbol.iterator] = customHeadersAny.entries;

    const originalForEach = customHeaders.forEach.bind(customHeaders);
    customHeadersAny.forEach = (callbackfn: (value: string, key: string, parent: Headers) => void, thisArg?: any) => {
      originalForEach((value, key, parent) => {
        if (key.toLowerCase() !== 'origin') {
          callbackfn.call(thisArg, value, key, parent);
        }
      });
    };

    newInit.headers = customHeaders;

    try {
      console.log(`[TauriFetch] Requesting: ${urlStr}`);
      console.log(`[TauriFetch] Headers passed to tauriFetch:`, Array.from((newInit.headers as Headers).entries()));
      const res = await tauriFetch(urlStr, newInit);
      console.log(`[TauriFetch] Status: ${res.status} for ${urlStr}`);
      return res;
    } catch (err) {
      console.error("[TauriFetch] Failed for AWS", err, { url: urlStr });
      throw err;
    }
  }

  // For all other requests (Vite HMR, local assets), use the native original fetch
  return (window as any).__originalFetch(input, init);
};

export const setAwsCredentials = (accessKeyId: string, secretAccessKey: string, sessionToken?: string, region: string = "us-east-1") => {
  s3ClientInstance = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken && { sessionToken })
    }
  });
  // IMPORTANT: Clear the regional client cache whenever credentials change!
  // Otherwise, we might use a cached client with old credentials.
  Object.keys(regionClients).forEach(key => delete regionClients[key]);
};

export const clearAwsCredentials = () => {
  s3ClientInstance = null;
  // Clear regional client cache too
  Object.keys(regionClients).forEach(key => delete regionClients[key]);
};

export const isAwsAuthenticated = () => {
  return s3ClientInstance !== null;
};

export const getCurrentActiveProfile = () => {
  return localStorage.getItem("aws_sso_profile");
};

export const getBuckets = async () => {
  if (!s3ClientInstance) throw new Error("AWS Credentials not set");
  const command = new ListBucketsCommand({});
  const response = await s3ClientInstance.send(command);
  return response.Buckets || [];
};

const regionClients: Record<string, S3Client> = {};

const getClientForBucket = async (bucketName: string): Promise<S3Client> => {
  if (!s3ClientInstance) throw new Error("AWS Credentials not set");

  // To avoid fetching location repeatedly, we can cache the region.
  try {
    const locCommand = new GetBucketLocationCommand({ Bucket: bucketName });
    const locRes = await s3ClientInstance.send(locCommand);
    let region = locRes.LocationConstraint || "us-east-1";
    // S3 API sometimes returns 'EU' instead of 'eu-west-1'
    if (region === 'EU') region = 'eu-west-1';

    if (regionClients[region]) return regionClients[region];

    const currentRegion = typeof s3ClientInstance.config.region === 'function'
      ? await (s3ClientInstance.config.region as any)()
      : s3ClientInstance.config.region;

    if (region === currentRegion) return s3ClientInstance;

    const creds = await s3ClientInstance.config.credentials();
    const newClient = new S3Client({
      region,
      credentials: creds
    });
    regionClients[region] = newClient;
    return newClient;
  } catch (error) {
    console.warn(`Could not determine region for bucket ${bucketName}, falling back to default client.`, error);
    return s3ClientInstance;
  }
};

export const listBucketObjects = async (bucketName: string, prefix: string = '') => {
  const client = await getClientForBucket(bucketName);
  console.log(`Listing objects for bucket: ${bucketName}, prefix: ${prefix}`);
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
    Delimiter: '/'
  });
  const response = await client.send(command);
  console.log('S3 Response:', response);

  return {
    files: response.Contents || [],
    folders: response.CommonPrefixes || []
  };
};

export const generatePresignedUrl = async (bucketName: string, key: string, expiresIn: number = 3600) => {
  const client = await getClientForBucket(bucketName);
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  });
  return await getSignedUrl(client, command, { expiresIn });
};

export const downloadS3File = async (bucketName: string, key: string, suggestedName: string) => {
  const url = await generatePresignedUrl(bucketName, key);

  // Ask user where to save
  const filePath = await save({
    defaultPath: suggestedName,
    filters: [{
      name: 'All Files',
      extensions: ['*']
    }]
  });

  if (!filePath) return;

  // Download via Tauri Fetch
  const response = await tauriFetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);

  const data = await response.arrayBuffer();

  // Write to disk
  await writeFile(filePath, new Uint8Array(data));
  return filePath;
};

import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

// Helper to ensure notification permissions
const ensureNotificationPermission = async () => {
  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === 'granted';
  }
  return permissionGranted;
};

export const startS3Download = async (bucketName: string, key: string, fileName: string) => {
  // 1. Ask where to save
  const savePath = await save({
    defaultPath: fileName,
    filters: [{ name: 'All Files', extensions: ['*'] }]
  });

  if (!savePath) return;

  const taskId = `${bucketName}-${key}-${Date.now()}`;
  const store = useDownloadStore.getState();

  // 2. Add to store (starts as 'queued')
  store.addTask({
    id: taskId,
    fileName,
    bucket: bucketName,
    key,
    status: 'queued',
    totalSize: 0,
    savePath
  });

  return taskId;
};

export const executeDownloadTask = async (taskId: string) => {
  const store = useDownloadStore.getState();
  const task = store.tasks.find(t => t.id === taskId);
  if (!task) return;

  try {
    store.updateTask(taskId, { status: 'downloading' });
    const url = await generatePresignedUrl(task.bucket, task.key);

    const response = await tauriFetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
    store.updateTask(taskId, { totalSize });

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Could not read response body");

    let downloadedSize = 0;
    let chunks: Uint8Array[] = [];
    let lastUpdate = Date.now();
    let lastSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      downloadedSize += value.length;

      const now = Date.now();
      if (now - lastUpdate > 500) { // Update every 500ms
        const progress = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0;
        const speedBytes = (downloadedSize - lastSize) / ((now - lastUpdate) / 1000);

        let speedStr = '';
        if (speedBytes > 1024 * 1024) speedStr = `${(speedBytes / (1024 * 1024)).toFixed(1)} MB/s`;
        else if (speedBytes > 1024) speedStr = `${(speedBytes / 1024).toFixed(1)} KB/s`;
        else speedStr = `${speedBytes.toFixed(0)} B/s`;

        store.updateTask(taskId, { progress, downloadedSize, speed: speedStr });

        lastUpdate = now;
        lastSize = downloadedSize;
      }
    }

    // Final merge and write
    const fullData = new Uint8Array(downloadedSize);
    let offset = 0;
    for (const chunk of chunks) {
      fullData.set(chunk, offset);
      offset += chunk.length;
    }

    await writeFile(task.savePath, fullData);
    store.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      downloadedSize,
      speed: '0 KB/s'
    });

    // Notify user
    if (await ensureNotificationPermission()) {
      sendNotification({
        title: 'Download Complete',
        body: `Finished downloading ${task.fileName}`,
        icon: 'i-heroicons-check-circle'
      });
    }
  } catch (err: any) {
    console.error("Download execution failed", err);
    store.updateTask(taskId, { status: 'error', error: err.message });

    // Notify error
    if (await ensureNotificationPermission()) {
      sendNotification({
        title: 'Download Failed',
        body: `Error downloading ${task.fileName}: ${err.message}`,
      });
    }
  }
};

export const uploadS3File = async (bucketName: string, key: string, fileData: Uint8Array, contentType?: string) => {
  const client = await getClientForBucket(bucketName);
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileData,
    ContentType: contentType
  });
  return await client.send(command);
};


