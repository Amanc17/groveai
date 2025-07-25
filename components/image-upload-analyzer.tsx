"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Upload, Loader2, CheckCircle, AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface AnalysisResult {
  disease: string
  confidence: number
  description?: string
}

interface ImageUploadAnalyzerProps {
  className?: string
}

export default function ImageUploadAnalyzer({ className = "" }: ImageUploadAnalyzerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [resizedImageUrl, setResizedImageUrl] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Resize image using canvas
  const resizeImage = useCallback((file: File, maxDimension = 512): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        reject(new Error("Could not get canvas context"))
        return
      }

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img

        if (width > height) {
          if (width > maxDimension) {
            height = (height * maxDimension) / width
            width = maxDimension
          }
        } else {
          if (height > maxDimension) {
            width = (width * maxDimension) / height
            height = maxDimension
          }
        }

        // Set canvas dimensions
        canvas.width = width
        canvas.height = height

        // Draw and resize image
        ctx.drawImage(img, 0, 0, width, height)

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error("Failed to create blob from canvas"))
            }
          },
          "image/jpeg",
          0.9,
        )
      }

      img.onerror = () => {
        reject(new Error("Failed to load image"))
      }

      // Set crossOrigin to handle CORS issues
      img.crossOrigin = "anonymous"
      img.src = URL.createObjectURL(file)
    })
  }, [])

  // Validate file
  const validateFile = useCallback((file: File): boolean => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    const maxSize = 10 * 1024 * 1024 // 10MB

    if (!validTypes.includes(file.type)) {
      setError("Please upload a valid image file (JPEG, PNG, or WebP)")
      return false
    }

    if (file.size > maxSize) {
      setError("Image file is too large. Please upload an image smaller than 10MB")
      return false
    }

    return true
  }, [])

  // Send image to API
  const analyzeImage = useCallback(async (imageBlob: Blob) => {
    setIsAnalyzing(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", imageBlob, "image.jpg")

      const response = await fetch("https://grove-ai-5.onrender.com/predict", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("The analysis service is temporarily unavailable.")
        } else if (response.status === 500) {
          throw new Error("Server error occurred. Please try again in a few moments.")
        } else if (response.status >= 400 && response.status < 500) {
          throw new Error("Invalid request. Please check your image and try again.")
        } else {
          throw new Error(`Request failed with status ${response.status}`)
        }
      }

      const data = await response.json()

      if (data.disease && typeof data.confidence === "number") {
        setResult({
          disease: data.disease.replace(/_+/g, " ").trim(),
          confidence: data.confidence * 100,
          description: data.description || "",
        })
      } else {
        throw new Error("Invalid response format from API")
      }
    } catch (err) {
      console.error("Analysis error:", err)

      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError("Unable to connect to the analysis service. Please check your internet connection and try again.")
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Analysis failed. Please try again with a different image.")
      }
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  // Handle file processing
  const processFile = useCallback(
    async (file: File) => {
      setError(null)

      if (!validateFile(file)) {
        return
      }

      setSelectedFile(file)

      // Create preview URL
      const preview = URL.createObjectURL(file)
      setPreviewUrl(preview)

      try {
        // Resize image
        const resizedBlob = await resizeImage(file, 512)

        // Create URL for resized image preview
        const resizedUrl = URL.createObjectURL(resizedBlob)
        setResizedImageUrl(resizedUrl)

        // Analyze the resized image
        await analyzeImage(resizedBlob)
      } catch (err) {
        console.error("Processing error:", err)
        setError(err instanceof Error ? err.message : "Failed to process image")
      }
    },
    [validateFile, resizeImage, analyzeImage],
  )

  // Handle file input change
  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        processFile(file)
      }
    },
    [processFile],
  )

  // Handle drag and drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types && e.dataTransfer.types.includes("Files")) {
      setIsDragActive(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragActive(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "copy"
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragActive(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        const file = files[0]
        if (file.type.startsWith("image/")) {
          processFile(file)
        }
      }
    },
    [processFile],
  )

  // Reset component
  const reset = useCallback(() => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setResizedImageUrl(null)
    setResult(null)
    setError(null)
    setIsAnalyzing(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  // Click to upload
  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className={`w-full max-w-4xl mx-auto space-y-6 ${className}`}>
      {/* Upload Area */}
      {!selectedFile && (
        <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
          <CardContent className="p-8">
            <div
              className={`text-center cursor-pointer transition-all duration-200 ${
                isDragActive ? "bg-blue-50 dark:bg-blue-900/20" : ""
              }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={handleClick}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="mb-4">
                <Upload className={`mx-auto h-12 w-12 ${isDragActive ? "text-blue-500" : "text-gray-400"}`} />
              </div>

              <div className="space-y-2">
                <p
                  className={`text-lg font-medium ${isDragActive ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}
                >
                  {isDragActive ? "Drop your image here" : "Upload Plant Image"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Drag and drop or click to browse</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  PNG, JPG, WebP up to 10MB (will be resized to 512px max)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Processing/Results Display */}
      {selectedFile && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Image Preview */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Original Image</h3>
              {previewUrl && (
                <img
                  src={previewUrl || "/placeholder.svg"}
                  alt="Original upload"
                  className="w-full h-48 object-cover rounded-lg mb-2"
                />
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            </CardContent>
          </Card>

          {/* Resized Image Preview */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Processed Image (512px max)</h3>
              {resizedImageUrl ? (
                <img
                  src={resizedImageUrl || "/placeholder.svg"}
                  alt="Resized for analysis"
                  className="w-full h-48 object-cover rounded-lg mb-2"
                />
              ) : (
                <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400">Resized for AI analysis</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analysis Status */}
      {isAnalyzing && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="p-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">Analyzing Your Plant...</h3>
            <p className="text-blue-700 dark:text-blue-300">Our AI is examining your image for signs of disease</p>
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {result && !isAnalyzing && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">Analysis Complete</h3>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-green-700 dark:text-green-300 mb-1">Disease Detected:</p>
                <p className="text-xl font-bold text-green-900 dark:text-green-100">{result.disease}</p>
              </div>

              <div>
                <p className="text-sm text-green-700 dark:text-green-300 mb-1">Confidence:</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-green-200 dark:bg-green-800 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${result.confidence}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold text-green-900 dark:text-green-100">
                    {result.confidence.toFixed(1)}%
                  </span>
                </div>
              </div>

              {result.description && (
                <div>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-1">Description:</p>
                  <p className="text-green-800 dark:text-green-200">{result.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {selectedFile && (
        <div className="flex gap-4 justify-center">
          <Button onClick={reset} variant="outline">
            Upload Another Image
          </Button>
          {result && (
            <Button onClick={() => window.print()} variant="secondary">
              Save Results
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
