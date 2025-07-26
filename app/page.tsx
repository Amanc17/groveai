"use client"

import type React from "react"

import { useState } from "react"
import { Upload, ArrowRight, Zap, Target, ChevronDown, ArrowLeft, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface AnalysisResult {
  disease: string
  confidence: number
  description: string
}

export default function Grove() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [currentView, setCurrentView] = useState<"home" | "analysis">("home")
  const [error, setError] = useState<string | null>(null)

  const demoImages = [
    { src: "/images/healthy-tomato-leaf.jpg", name: "Garden Leaf Sample" },
    { src: "/images/potato-early-blight.jpg", name: "Crop Leaf Sample" },
    { src: "/images/apple-scab.jpg", name: "Fruit Tree Leaf Sample" },
  ]

  const faqData = [
    {
      question: "How accurate is Grove's disease detection?",
      answer:
        "Grove achieves over 95% accuracy in detecting common plant diseases, trained on thousands of plant images from agricultural databases.",
    },
    {
      question: "What types of plants does Grove support?",
      answer:
        "Grove currently supports vegetables, fruits, and common houseplants. We can detect 30+ diseases across tomatoes, potatoes, apples, and many other plants.",
    },
    {
      question: "Is Grove free to use?",
      answer:
        "Yes! Grove is completely free to use. Simply upload a photo and get instant results with disease identification.",
    },
    {
      question: "What makes a good photo for analysis?",
      answer:
        "Take a clear, well-lit photo of the affected leaf. Ensure the leaf fills most of the frame and the symptoms are clearly visible.",
    },
  ]

  const validateImage = (file: File): boolean => {
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
  }

  const resizeAndCompressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        reject(new Error("Could not get canvas context"))
        return
      }

      img.onload = () => {
        // Calculate new dimensions (max width 512px, maintain aspect ratio)
        let { width, height } = img
        const maxWidth = 512

        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        // Set canvas dimensions
        canvas.width = width
        canvas.height = height

        // Draw and resize image
        ctx.drawImage(img, 0, 0, width, height)

        // Convert to compressed JPEG blob (~80% quality)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error("Failed to create compressed image"))
            }
          },
          "image/jpeg",
          0.8,
        )
      }

      img.onerror = () => {
        reject(new Error("Failed to load image"))
      }

      // Set crossOrigin to handle CORS issues
      img.crossOrigin = "anonymous"
      img.src = URL.createObjectURL(file)
    })
  }

  const analyzeImageWithAPI = async (file: File) => {
    setIsAnalyzing(true)
    setResult(null)
    setError(null)
    setCurrentView("analysis")

    try {
      // Resize and compress the image first
      const compressedBlob = await resizeAndCompressImage(file)

      const formData = new FormData()
      formData.append("file", compressedBlob, "image.jpg")

      const response = await fetch("https://grove-ai-6.onrender.com/predict", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("The service may be temporarily unavailable.")
        } else if (response.status === 500) {
          throw new Error("Server error occurred. Please try again in a few moments.")
        } else if (response.status >= 400 && response.status < 500) {
          throw new Error("Invalid request. Please check your image format and try again.")
        } else {
          throw new Error(`API request failed with status ${response.status}`)
        }
      }

      const data = await response.json()

      if (data.disease && typeof data.confidence === "number" && data.description) {
        setResult({
          disease: data.disease.replace(/_+/g, " ").trim(),
          confidence: data.confidence * 100,
          description: data.description,
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

      setCurrentView("home")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setError(null)

      if (!validateImage(file)) {
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string)
        analyzeImageWithAPI(file)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDragDrop = (file: File) => {
    setError(null)

    if (!validateImage(file)) {
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string)
      analyzeImageWithAPI(file)
    }
    reader.readAsDataURL(file)
  }

  const handleDemoImage = async (imageName: string, imageSrc: string) => {
    setError(null)
    setUploadedImage(imageSrc)
    setIsDemoMode(true)

    try {
      // Convert image to blob for demo
      const response = await fetch(imageSrc)
      const blob = await response.blob()
      const file = new File([blob], `${imageName}.jpg`, { type: "image/jpeg" })

      analyzeImageWithAPI(file)
    } catch (err) {
      setError("Demo analysis failed. Please try uploading your own image.")
    }
  }

  const resetAnalysis = () => {
    setUploadedImage(null)
    setResult(null)
    setIsDemoMode(false)
    setCurrentView("home")
    setError(null)
  }

  if (currentView === "analysis") {
    return (
      <div className="min-h-screen bg-grove-dark">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-6 py-4 bg-[#0D1F0F] w-full border-b border-grove-light/10 sticky top-0 z-50">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <img src="/images/grove-latest-logo.png" alt="Grove logo" className="h-12 w-auto" />
          </div>
          {/* Right: Back Button */}
          <Button
            onClick={resetAnalysis}
            variant="outline"
            className="border-grove-light/30 text-grove-light hover:bg-grove-light/10 bg-transparent rounded-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </nav>

        {/* Analysis Screen */}
        <div className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h1 className="text-4xl lg:text-5xl font-bold text-white mb-6">Analysis Results</h1>
              <p className="text-xl text-grove-light">AI-powered plant disease detection</p>
            </div>

            {isAnalyzing ? (
              <Card className="bg-grove-light/5 border-grove-light/20 rounded-2xl">
                <CardContent className="p-12 text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-grove-accent mx-auto mb-6"></div>
                  <h3 className="text-2xl font-bold text-white mb-4">Analyzing Your Plant...</h3>
                  <p className="text-grove-light text-lg">Our AI is examining your image for signs of disease</p>
                  <div className="mt-8 bg-grove-light/10 rounded-full h-2 overflow-hidden">
                    <div className="bg-grove-accent h-full rounded-full animate-pulse" style={{ width: "70%" }}></div>
                  </div>
                </CardContent>
              </Card>
            ) : result ? (
              <div className="space-y-8">
                {/* Image Display */}
                <Card className="bg-grove-light/5 border-grove-light/20 rounded-2xl overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row gap-8">
                      <div className="lg:w-1/2">
                        <img
                          src={uploadedImage || "/placeholder.svg"}
                          alt="Analyzed plant"
                          className="w-full h-64 lg:h-80 object-cover rounded-xl"
                        />
                      </div>
                      <div className="lg:w-1/2 space-y-6">
                        <div>
                          <h3 className="text-2xl font-bold text-white mb-4">Disease Identification</h3>
                          <div className="p-4 rounded-xl border bg-grove-accent/10 border-grove-accent/20">
                            <h4 className="text-xl font-semibold text-white mb-2">{result.disease}</h4>
                            <div className="flex items-center gap-4">
                              <span className="text-grove-light">Confidence:</span>
                              <span className="font-bold text-grove-accent text-lg">
                                {result.confidence.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Description */}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    onClick={resetAnalysis}
                    className="bg-grove-accent hover:bg-grove-accent/90 text-grove-dark px-8 py-3 text-lg font-semibold rounded-full"
                  >
                    Analyze Another Image
                  </Button>
                  <Button
                    variant="outline"
                    className="border-grove-light/30 text-grove-light hover:bg-grove-light/10 bg-transparent px-8 py-3 text-lg font-medium rounded-full"
                    onClick={() => window.print()}
                  >
                    Save Results
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-grove-dark">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 bg-[#0D1F0F] w-full border-b border-grove-light/10 sticky top-0 z-50">
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <img src="/images/grove-latest-logo.png" alt="Grove logo" className="h-12 w-auto" />
        </div>
        {/* Right: Nav Links - Desktop */}
        <div className="hidden md:flex gap-6 text-white font-medium">
          <button
            onClick={() => document.getElementById("home")?.scrollIntoView({ behavior: "smooth" })}
            className="hover:text-green-400 transition-colors"
          >
            Home
          </button>
          <button
            onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            className="hover:text-green-400 transition-colors"
          >
            How it Works
          </button>
          <button
            onClick={() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })}
            className="hover:text-green-400 transition-colors"
          >
            About
          </button>
          <button
            onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
            className="hover:text-green-400 transition-colors"
          >
            Contact
          </button>
        </div>
        {/* Mobile Navigation */}
        <div className="md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-white hover:text-green-400 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0D1F0F] border-t border-grove-light/10">
          <div className="px-6 py-2 space-y-2">
            <button
              onClick={() => {
                document.getElementById("home")?.scrollIntoView({ behavior: "smooth" })
                setMobileMenuOpen(false)
              }}
              className="block w-full text-left py-2 text-white hover:text-green-400 transition-colors font-medium"
            >
              Home
            </button>
            <button
              onClick={() => {
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })
                setMobileMenuOpen(false)
              }}
              className="block w-full text-left py-2 text-white hover:text-green-400 transition-colors font-medium"
            >
              How it Works
            </button>
            <button
              onClick={() => {
                document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })
                setMobileMenuOpen(false)
              }}
              className="block w-full text-left py-2 text-white hover:text-green-400 transition-colors font-medium"
            >
              About
            </button>
            <button
              onClick={() => {
                document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })
                setMobileMenuOpen(false)
              }}
              className="block w-full text-left py-2 text-white hover:text-green-400 transition-colors font-medium"
            >
              Contact
            </button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section id="home" className="py-20 lg:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Diagnose Plant Diseases
              <span className="block text-grove-accent">Instantly with AI</span>
            </h1>
            <p className="text-xl lg:text-2xl text-grove-light mb-12 leading-relaxed">
              Upload a photo of your plant's leaf and get instant results. Grove identifies 30+ plant diseases with high
              accuracy—free to use.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-grove-accent hover:bg-grove-accent/90 text-grove-dark px-10 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all"
                onClick={() => document.getElementById("upload-section")?.scrollIntoView({ behavior: "smooth" })}
              >
                Start Diagnosis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-grove-light/30 text-grove-light hover:bg-grove-light/10 px-8 py-4 text-lg font-medium rounded-full bg-transparent"
                onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
              >
                Try Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-grove-dark/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">How Grove Works</h2>
            <p className="text-xl text-grove-light max-w-2xl mx-auto">
              Get plant disease diagnosis in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-grove-accent/10 border border-grove-accent/20 rounded-2xl p-8 mb-6">
                <div className="bg-grove-accent rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Upload className="h-8 w-8 text-grove-dark" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">1. Upload</h3>
                <p className="text-grove-light">
                  Take a clear photo of your plant's leaf showing any symptoms or concerns
                </p>
              </div>
            </div>

            <div className="text-center">
              <div className="bg-grove-accent/10 border border-grove-accent/20 rounded-2xl p-8 mb-6">
                <div className="bg-grove-accent rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-grove-dark" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">2. Detect</h3>
                <p className="text-grove-light">
                  Our AI analyzes your image and identifies potential diseases with high accuracy
                </p>
              </div>
            </div>

            <div className="text-center">
              <div className="bg-grove-accent/10 border border-grove-accent/20 rounded-2xl p-8 mb-6">
                <div className="bg-grove-accent rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Target className="h-8 w-8 text-grove-dark" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">3. Get Results</h3>
                <p className="text-grove-light">
                  Receive instant diagnosis with detailed information about the detected condition
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Upload Section */}
      <section id="upload-section" className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">Upload Your Plant Photo</h2>
            <p className="text-xl text-grove-light">Get instant AI-powered diagnosis</p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-8 max-w-2xl mx-auto">
              <Card className="bg-red-400/10 border-red-400/20 rounded-2xl">
                <CardContent className="p-6 flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 font-medium">{error}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex justify-center">
            <Card className="bg-grove-light/5 border-grove-light/20 rounded-2xl overflow-hidden max-w-md w-full">
              <CardContent className="p-8 flex items-center justify-center min-h-[400px]">
                <div
                  className="border-2 border-dashed border-grove-light/30 rounded-xl p-12 text-center hover:border-grove-accent/50 transition-colors w-full flex flex-col items-center justify-center cursor-pointer"
                  onClick={() => document.getElementById("file-upload")?.click()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files[0]
                    if (file && file.type.startsWith("image/")) {
                      handleDragDrop(file)
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={(e) => e.preventDefault()}
                >
                  <div className="bg-grove-accent/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Upload className="h-8 w-8 text-grove-accent" />
                  </div>
                  <p className="text-grove-light mb-6 text-lg text-center">Click to upload or drag and drop</p>
                  <p className="text-grove-light/70 mb-6 text-sm text-center">
                    Supports JPEG, PNG, WebP (max 10MB) - automatically resized to 512px
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button className="bg-grove-accent hover:bg-grove-accent/90 text-grove-dark font-semibold rounded-full pointer-events-none">
                    Choose File
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-20 bg-grove-dark/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">Try Our Demo</h2>
            <p className="text-xl text-grove-light">Don't have a plant photo? Try these sample images</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {demoImages.map((demo, index) => (
              <Card
                key={index}
                className="bg-grove-light/5 border-grove-light/20 rounded-2xl overflow-hidden hover:bg-grove-light/10 transition-colors cursor-pointer"
              >
                <CardContent className="p-6">
                  <img
                    src={demo.src || "/placeholder.svg"}
                    alt={demo.name}
                    className="w-full h-48 object-cover rounded-xl mb-4"
                  />
                  <h3 className="font-semibold text-white mb-4 text-lg">{demo.name}</h3>
                  <Button
                    className="w-full bg-grove-accent hover:bg-grove-accent/90 text-grove-dark font-semibold rounded-full"
                    onClick={() => handleDemoImage(demo.name, demo.src)}
                  >
                    Analyze Sample
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-8">About Grove</h2>
          <div className="bg-grove-light/5 border border-grove-light/20 rounded-2xl p-8 lg:p-12">
            <p className="text-xl text-grove-light leading-relaxed mb-6">
              Grove is an AI-powered plant disease detection system designed to help gardeners, farmers, and plant
              enthusiasts maintain healthier plants. Our advanced machine learning model can identify over 30 common
              plant diseases with high accuracy.
            </p>
            <p className="text-lg text-grove-light leading-relaxed">
              Built as an independent research project, Grove combines cutting-edge AI technology with agricultural
              expertise to make plant disease diagnosis accessible to everyone—completely free.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-grove-dark/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            {faqData.map((faq, index) => (
              <Card key={index} className="bg-grove-light/5 border-grove-light/20 rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                  <button
                    className="w-full p-6 text-left flex justify-between items-center hover:bg-grove-light/5 transition-colors"
                    onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  >
                    <span className="text-white font-semibold text-lg">{faq.question}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-grove-light transition-transform ${expandedFaq === index ? "rotate-180" : ""}`}
                    />
                  </button>
                  {expandedFaq === index && (
                    <div className="px-6 pb-6">
                      <p className="text-grove-light leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What Grove Can Detect Section */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">What Grove Can Detect</h2>
            <p className="text-xl text-grove-light max-w-3xl mx-auto">
              Grove's AI has been trained to identify diseases across a wide variety of plants. Here's what we can
              currently diagnose:
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Apple */}
            <Card className="bg-grove-light/5 border-grove-light/20 rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-white">Apple</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-grove-accent rounded-full"></div>
                    <span className="text-grove-light">Healthy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Apple Scab</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Black Rot</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Cedar Apple Rust</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tomato */}
            <Card className="bg-grove-light/5 border-grove-light/20 rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-white">Tomato</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-grove-accent rounded-full"></div>
                    <span className="text-grove-light">Healthy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Bacterial Spot</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Early Blight</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Late Blight</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Leaf Mold</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Septoria Leaf Spot</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Spider Mite</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Target Spot</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Tomato Mosaic Virus</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Tomato Yellow Leaf Curl Virus</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Potato */}
            <Card className="bg-grove-light/5 border-grove-light/20 rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-white">Potato</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-grove-accent rounded-full"></div>
                    <span className="text-grove-light">Healthy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Early Blight</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Late Blight</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Corn (Maize) */}
            <Card className="bg-grove-light/5 border-grove-light/20 rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-white">Corn (Maize)</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-grove-accent rounded-full"></div>
                    <span className="text-grove-light">Healthy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Cercospora Leaf Spot Gray Leaf Spot</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Common Rust</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Northern Leaf Blight</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Grape */}
            <Card className="bg-grove-light/5 border-grove-light/20 rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-white">Grape</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-grove-accent rounded-full"></div>
                    <span className="text-grove-light">Healthy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Black Rot</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Esca (Black Measles)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Leaf Blight (Isariopsis Leaf Spot)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Peach */}
            <Card className="bg-grove-light/5 border-grove-light/20 rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-white">Peach</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-grove-accent rounded-full"></div>
                    <span className="text-grove-light">Healthy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Bacterial Spot</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bell Pepper */}
            <Card className="bg-grove-light/5 border-grove-light/20 rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-white">Bell Pepper</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-grove-accent rounded-full"></div>
                    <span className="text-grove-light">Healthy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Bacterial Spot</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cherry */}
            <Card className="bg-grove-light/5 border-grove-light/20 rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-white">Cherry</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-grove-accent rounded-full"></div>
                    <span className="text-grove-light">Healthy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Powdery Mildew</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Strawberry */}
            <Card className="bg-grove-light/5 border-grove-light/20 rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-white">Strawberry</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-grove-accent rounded-full"></div>
                    <span className="text-grove-light">Healthy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Leaf Scorch</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Orange */}
            <Card className="bg-grove-light/5 border-grove-light/20 rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-white">Orange</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-grove-light">Huanglongbing (Citrus Greening)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Healthy Only Plants */}
            <Card className="bg-grove-light/5 border-grove-light/20 rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-white">Other Plants</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-grove-accent rounded-full"></div>
                    <span className="text-grove-light">Blueberry (Healthy)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-grove-accent rounded-full"></div>
                    <span className="text-grove-light">Raspberry (Healthy)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-grove-accent rounded-full"></div>
                    <span className="text-grove-light">Soybean (Healthy)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Card className="bg-grove-accent/10 border-grove-accent/20 rounded-2xl inline-block">
              <CardContent className="p-6">
                <p className="text-grove-light text-lg">
                  <span className="text-grove-accent font-semibold">Note:</span> If your plant isn't listed here, Grove
                  may not be able to diagnose it accurately yet.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-grove-dark border-t border-grove-light/10 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <img src="/images/grove-latest-logo.png" alt="Grove Logo" className="h-10 w-auto" />
            </div>
            <p className="text-grove-light mb-6 max-w-2xl mx-auto">
              AI-powered plant disease detection for healthier gardens and crops. Built with care for plant lovers
              everywhere.
            </p>
            <div className="text-grove-light">
              <p className="mb-2">Questions or feedback?</p>
              <a
                href="mailto:hellogrove.ai@gmail.com"
                className="text-grove-accent hover:text-grove-accent/80 transition-colors font-medium"
              >
                hellogrove.ai@gmail.com
              </a>
            </div>
          </div>

          <div className="border-t border-grove-light/10 mt-8 pt-8 text-center">
            <p className="text-grove-light/70">© 2025 Grove. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
