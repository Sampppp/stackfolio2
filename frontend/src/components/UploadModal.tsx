import React, { useState } from 'react';
import PocketBase from 'pocketbase';
import ExifReader from 'exifreader';

const pb = new PocketBase('http://localhost:8090');

interface UploadModalProps {
  onClose: () => void;
  onUploadSuccess: () => void;
}

export default function UploadModal({ onClose, onUploadSuccess }: UploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Convert FileList to an Array
      setFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    // Loop through each file sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let metadata = { camera: '', lens: '', aperture: '', shutter_speed: '', iso: '' };

      const getDimensions = (): Promise<{ width: number; height: number }> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            resolve({ width: img.width, height: img.height });
            URL.revokeObjectURL(img.src); // Cleanup memory
          };
          img.src = URL.createObjectURL(file);
        });
      };

      const dimensions = await getDimensions();

      try {
        // Extract EXIF for this specific file
        const tags = await ExifReader.load(file);
        metadata = {
          camera: tags['Model']?.description || '',
          lens: tags['LensModel']?.description || '',
          aperture: tags['FNumber']?.description || '',
          shutter_speed: tags['ExposureTime']?.description || '',
          iso: tags['ISOSpeedRatings']?.description || '',
        };
      } catch (error) {
        console.warn(`Could not read EXIF for ${file.name}:`, error);
      }

      // Construct payload for this specific file
      const data = {
        image: file,
        width: dimensions.width,
        height: dimensions.height,
        ...metadata,
      };

      try {
        await pb.collection('photos').create(data);
        setUploadProgress({ current: i + 1, total: files.length });
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
        // Continue to the next file even if one fails
      }
    }

    setIsUploading(false);
    onUploadSuccess(); // Refresh gallery
    onClose();         // Close modal
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-gray-900 w-full max-w-lg rounded-2xl p-6 border border-gray-800 shadow-2xl">
        <h2 className="text-xl font-bold mb-4 text-white">Upload Photos</h2>

        <form onSubmit={handleUpload} className="space-y-4">
          {/* File Input Area - Now accepts multiple files */}
          <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-blue-500 transition-colors bg-gray-950 relative">
            <input
              type="file"
              accept="image/jpeg, image/jpg"
              multiple
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="file-upload"
              disabled={isUploading}
            />
            <div className="pointer-events-none">
              <span className="text-gray-300 block mb-2 font-medium">
                Drag & Drop or Click to Select
              </span>
              <span className="text-blue-400 text-sm">Select multiple .jpg files</span>
            </div>
          </div>

          {/* Selected Files List */}
          {files.length > 0 && (
            <div className="max-h-48 overflow-y-auto bg-gray-950 rounded-lg p-2 border border-gray-800">
              <div className="text-xs text-gray-400 mb-2 px-2 uppercase tracking-wider font-semibold">
                {files.length} Photo{files.length !== 1 ? 's' : ''} Selected
              </div>
              <ul className="space-y-1">
                {files.map((file, idx) => (
                  <li key={idx} className="flex justify-between items-center text-sm text-gray-300 bg-gray-900 p-2 rounded">
                    <span className="truncate pr-4">{file.name}</span>
                    {!isUploading && (
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-red-400 hover:text-red-300 shrink-0"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Upload Progress Indicator */}
          {isUploading && uploadProgress && (
            <div className="w-full bg-gray-800 rounded-full h-2.5 mt-4 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
              ></div>
              <p className="text-xs text-center text-gray-400 mt-2">
                Uploading {uploadProgress.current} of {uploadProgress.total}...
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={files.length === 0 || isUploading}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400 px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {isUploading ? 'Processing...' : 'Upload All'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}