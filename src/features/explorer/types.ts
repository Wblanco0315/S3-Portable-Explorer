export interface S3Object {
    id: string;
    name: string;
    type: string;
    date: string;
    size: string;
    rawSize: number;
    storageClass: string;
}

export type SortKey = 'name' | 'type' | 'date' | 'size' | 'storageClass';

export interface SortConfig {
    key: SortKey;
    direction: 'asc' | 'desc';
}
