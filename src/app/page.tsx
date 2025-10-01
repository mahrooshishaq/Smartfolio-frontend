export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-orange-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">SmartFolio AI</h1>
        <div className="space-x-4">
          <a href="/login" className="px-6 py-3 bg-blue-500 text-white rounded">Login</a>
          <a href="/signup" className="px-6 py-3 bg-green-500 text-white rounded">Sign Up</a>
        </div>
      </div>
    </div>
  );
}
