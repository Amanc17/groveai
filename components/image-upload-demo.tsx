"use client"

import ImageUploadAnalyzer from "./image-upload-analyzer"

export default function ImageUploadDemo() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Plant Disease Detection</h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Upload an image of a plant leaf to detect diseases using AI. Images are automatically resized to 512px for
            optimal analysis.
          </p>
        </div>

        <ImageUploadAnalyzer />
      </div>
    </div>
  )
}
