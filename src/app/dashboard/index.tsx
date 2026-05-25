export default function DashboardView() {
  return (
    <div className="p-8 bg-gray-50 min-h-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">S3 Explorer</h1>
        <p className="text-gray-600">Manage your buckets and files with ease.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Simple stat cards */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 uppercase">Total Buckets</h3>
          <p className="text-2xl font-bold text-indigo-600">12</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 uppercase">Storage Used</h3>
          <p className="text-2xl font-bold text-indigo-600">45.2 GB</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 uppercase">Objects</h3>
          <p className="text-2xl font-bold text-indigo-600">1,234</p>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="font-semibold text-gray-800">Recent Buckets</h2>
        </div>
        <div className="p-6">
          <p className="text-gray-500 text-sm italic">Connect your AWS account to start browsing...</p>
        </div>
      </div>
    </div>
  );
}
