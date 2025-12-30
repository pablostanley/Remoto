export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-4xl font-bold mb-4">Remoto</h1>
      <p className="text-gray-400 mb-8 max-w-md">
        Control your terminal from your phone. Scan the QR code displayed in your terminal to connect.
      </p>
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
        <p className="text-sm text-gray-500 mb-4">To get started, run:</p>
        <code className="bg-gray-800 px-4 py-2 rounded block text-green-400">
          npx remoto
        </code>
        <p className="text-sm text-gray-500 mt-4">
          Then scan the QR code with your phone camera.
        </p>
      </div>
    </main>
  );
}
