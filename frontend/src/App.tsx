import { useState, useEffect, useCallback } from 'react';
import PocketBase from 'pocketbase';
import UploadModal from './components/UploadModal.tsx';

// Connect to the PocketBase backend
const pb = new PocketBase('http://localhost:8090');

// Define the Photo interface based on the PocketBase schema
interface Photo {
  id: string;
  collectionId: string;
  collectionName: string;
  image: string;
  camera?: string;
  lens?: string;
  iso?: string | number;
  aperture?: string;
  shutter_speed?: string;
  created: string;
}

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [activePhoto, setActivePhoto] = useState<Photo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Memoize the fetch function so we can pass it to the UploadModal as a callback
  const fetchPhotos = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await pb.collection('photos').getFullList<Photo>({
        sort: '-created', // Newest first
      });
      setPhotos(records);
    } catch (error) {
      console.error("Failed to fetch photos:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch photos on initial load
  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans transition-colors duration-300">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center max-w-7xl mx-auto border-b border-border pb-4">        <h1 className="text-3xl font-bold text-white tracking-tight">Portfolio</h1>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Portfolio</h1>
        <button
          onClick={() => setIsUploadOpen(true)}
          className="bg-primary text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm"        >
          Add Photo
        </button>
      </header>

      {/* Loading State */}
      {isLoading && photos.length === 0 ? (
        <div className="flex justify-center items-center h-64 text-muted">
          Loading gallery...
        </div>
      ) : (
        /* CSS Masonry Grid */
        <div className="max-w-7xl mx-auto columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-2 space-y-2">
          {photos.map((photo) => {
            // Request the 400px wide thumbnail for the gallery view to save bandwidth
            const thumbUrl = pb.files.getURL(photo, photo.image, { thumb: '400x0' });

            return (
              <div
                key={photo.id}
                className="break-inside-avoid cursor-zoom-in group relative overflow-hidden bg-surface shadow-sm hover:shadow-lg transition-all border border-border"
                onClick={() => setActivePhoto(photo)}
              >
                <img
                  src={thumbUrl}
                  alt={photo.camera ? `Taken with ${photo.camera}` : "Gallery photo"}
                  className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  loading="lazy"
                />

                {/* Hover Overlay with Metadata Preview */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <div className="text-white text-xs font-medium">
                    {photo.camera && <span>{photo.camera}</span>}
                    {photo.camera && photo.lens && <span className="mx-1">•</span>}
                    {photo.lens && <span>{photo.lens}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {isUploadOpen && (
        <UploadModal
          onClose={() => setIsUploadOpen(false)}
          onUploadSuccess={fetchPhotos}
        />
      )}

      {/* Lightbox / Full Resolution Modal */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-8"
          onClick={() => setActivePhoto(null)}
        >
          {/* Close Button */}
          <button
            className="absolute top-6 right-6 text-white/70 hover:text-white p-2 transition-colors z-10"
            onClick={() => setActivePhoto(null)}
            aria-label="Close lightbox"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Full Resolution Image */}
          <img
            src={pb.files.getURL(activePhoto, activePhoto.image)}
            alt="Full resolution"
            className="max-h-[85vh] max-w-full object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* EXIF Data Bar */}
          <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-3 md:gap-6 text-xs md:text-sm text-gray-200 bg-black/60 px-6 py-3 rounded-full backdrop-blur-lg border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {activePhoto.camera && (
              <span className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                {activePhoto.camera}
              </span>
            )}
            {activePhoto.lens && <span>{activePhoto.lens}</span>}
            {activePhoto.aperture && <span>ƒ/{activePhoto.aperture}</span>}
            {activePhoto.shutter_speed && <span>{activePhoto.shutter_speed}s</span>}
            {activePhoto.iso && <span>ISO {activePhoto.iso}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
