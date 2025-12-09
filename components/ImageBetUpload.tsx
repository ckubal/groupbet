'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';

interface ImageBetUploadProps {
  onBetExtracted: (betData: {
    gameId: string;
    weekendId: string;
    betType: 'spread' | 'over_under' | 'moneyline' | 'player_prop';
    selection: string;
    odds: number;
    line?: number;
    totalAmount: number;
    amountPerPerson: number;
    placedBy: string;
    participants: string[];
  }) => void;
  currentUser: string;
  defaultParticipants: string[];
}

export default function ImageBetUpload({ 
  onBetExtracted, 
  currentUser,
  defaultParticipants 
}: ImageBetUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      setSelectedFile(file);
      setError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch('/api/extract-bet-from-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract bet information');
      }

      if (data.extractedText) {
        setExtractedText(data.extractedText);
      }

      if (data.betData) {
        // Use extracted bet data
        onBetExtracted({
          ...data.betData,
          placedBy: currentUser,
          participants: defaultParticipants,
        });
        handleClose();
      } else {
        setError('Could not extract bet information. Please check the image quality and try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setImagePreview(null);
    setSelectedFile(null);
    setError(null);
    setExtractedText(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Upload className="w-5 h-5" />
        <span>Upload Bet Image</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <h2 className="text-2xl font-bold text-gray-900">Upload Bet Image</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full p-1 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {!imagePreview ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-700 mb-2 text-lg font-medium">
                  Take a photo or select from camera roll
                </p>
                <p className="text-gray-500 mb-6 text-sm">
                  Upload an image of your bet slip to automatically extract bet details
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer font-medium shadow-md hover:shadow-lg transition-all"
                >
                  Select Image
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Preview Container */}
              <div className="relative bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                <div className="max-h-[400px] overflow-hidden flex items-center justify-center">
                  <img
                    src={imagePreview}
                    alt="Bet preview"
                    className="max-w-full max-h-[400px] object-contain"
                  />
                </div>
                <button
                  onClick={() => {
                    setImagePreview(null);
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="absolute top-3 right-3 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 shadow-lg transition-colors"
                  aria-label="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {extractedText && (
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Extracted Text:</p>
                  <div className="bg-white p-3 rounded border border-gray-200 max-h-32 overflow-y-auto">
                    <p className="text-xs text-gray-800 font-mono whitespace-pre-wrap break-words">
                      {extractedText}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  <p className="font-medium">Error</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isProcessing || !selectedFile}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg transition-all"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Extract Bet
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

