import React, { useState, useEffect, useCallback } from 'react';
import PocketBase from 'pocketbase';
import UploadModal from './components/UploadModal.tsx';
import { RowsPhotoAlbum } from "react-photo-album";
import "react-photo-album/rows.css";

const pb = new PocketBase('/');

interface Photo {
  id: string;
  collectionId: string;
  collectionName: string;
  image: string;
  width: number;
  height: number;
  camera?: string;
  lens?: string;
  iso?: string | number;
  aperture?: string;
  shutter_speed?: string;
  created: string;
}

export default function App() {
  // --- Auth State ---
  const [isAdmin, setIsAdmin] = useState(pb.authStore.isValid && pb.authStore.isSuperuser); const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- App State ---
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // --- Selection State ---
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Listen for auth state changes globally
  useEffect(() => {
    return pb.authStore.onChange(() => {
      setIsAdmin(pb.authStore.isValid && pb.authStore.isSuperuser);
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsProcessing(true);
    try {
      await pb.collection('_superusers').authWithPassword(loginEmail, loginPassword);

      setIsLoginOpen(false);
      setLoginEmail('');
      setLoginPassword('');
    } catch (err) {
      setLoginError('Invalid email or password');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    setIsAdmin(false);
  };

  const openLightbox = (photo: Photo) => {
    setLightboxPhoto(photo);
    setTimeout(() => setIsLightboxOpen(true), 10);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    setTimeout(() => setLightboxPhoto(null), 300);
  };

  const fetchPhotos = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await pb.collection('photos').getFullList<Photo>({
        sort: '-created',
      });
      setPhotos(records);
    } catch (error) {
      console.error("Failed to fetch photos:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const toggleSelection = (id: string) => {
    setSelectedPhotos(prev =>
      prev.includes(id) ? prev.filter(photoId => photoId !== id) : [...prev, id]
    );
  };

  const cancelSelection = () => {
    setIsSelectMode(false);
    setSelectedPhotos([]);
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedPhotos.length} photo(s)?`)) return;

    setIsProcessing(true);
    try {
      for (const id of selectedPhotos) {
        await pb.collection('photos').delete(id);
      }
      cancelSelection();
      await fetchPhotos();
    } catch (error) {
      console.error("Failed to delete photos:", error);
      alert("Error deleting photos. Make sure you are logged in as Admin.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSelected = async () => {
    setIsProcessing(true);
    try {
      const photosToDownload = photos.filter(p => selectedPhotos.includes(p.id));

      for (const photo of photosToDownload) {
        const url = pb.files.getURL(photo, photo.image);
        const response = await fetch(url);
        const blob = await response.blob();

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = photo.image;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        await new Promise(resolve => setTimeout(resolve, 300));
      }
      cancelSelection();
    } catch (error) {
      console.error("Download failed:", error);
      alert("An error occurred while downloading.");
    } finally {
      setIsProcessing(false);
    }
  };

  const formattedPhotos = photos.map((photo) => ({
    src: pb.files.getURL(photo, photo.image, { thumb: '0x800' }),
    width: photo.width || 1,
    height: photo.height || 1,
    originalData: photo,
  }));

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans transition-colors duration-300 flex flex-col">

      {/* Header Context Bar */}
      <header className="mb-8 flex justify-between items-center max-w-7xl mx-auto border-b border-border pb-4 h-14 w-full">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Portfolio</h1>

          {/* Subtle Admin Controls */}
          {isAdmin ? (
            <button onClick={handleLogout} className="text-xs text-muted hover:text-red-400 mt-2 transition-colors">
              Logout Admin
            </button>
          ) : (
            <button onClick={() => setIsLoginOpen(true)} className="text-xs text-muted hover:text-primary mt-2 transition-colors opacity-30 hover:opacity-100">
              Admin Login
            </button>
          )}
        </div>

        <div className="flex gap-3 items-center">
          {isSelectMode ? (
            <>
              <span className="text-sm font-medium text-muted mr-2">
                {selectedPhotos.length} selected
              </span>
              <button
                onClick={handleDownloadSelected}
                disabled={selectedPhotos.length === 0 || isProcessing}
                className="bg-surface text-foreground border border-border px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                Download
              </button>

              {/* Only Admins can Delete */}
              {isAdmin && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={selectedPhotos.length === 0 || isProcessing}
                  className="bg-red-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {isProcessing ? 'Processing...' : 'Delete'}
                </button>
              )}

              <button
                onClick={cancelSelection}
                disabled={isProcessing}
                className="text-muted hover:text-foreground px-2 py-2 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsSelectMode(true)}
                disabled={photos.length === 0}
                className="text-muted hover:text-foreground px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Select
              </button>

              {/* Only Admins can Add Photos */}
              {isAdmin && (
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="bg-primary text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm"
                >
                  Add Photo
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-grow">
        {isLoading && photos.length === 0 ? (
          <div className="flex justify-center items-center h-64 text-muted">
            Loading gallery...
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            <RowsPhotoAlbum
              photos={formattedPhotos}
              targetRowHeight={350}
              spacing={4}
              onClick={({ photo }) => {
                if (isSelectMode) {
                  toggleSelection((photo.originalData as Photo).id);
                } else {
                  openLightbox(photo.originalData as Photo);
                }
              }}
              render={{
                image: (props, { photo }) => {
                  const pbData = photo.originalData as Photo;
                  const hasMetadata = pbData.camera || pbData.lens;
                  const isSelected = selectedPhotos.includes(pbData.id);
                  const { style, ...restImageProps } = props;

                  return (
                    <div
                      style={{ ...style, position: 'relative' }}
                      className={`group overflow-hidden rounded-sm cursor-zoom-in transition-all ${isSelectMode && isSelected ? 'ring-4 ring-primary ring-inset opacity-90' : 'shadow-sm hover:shadow-xl'
                        }`}
                    >
                      <img
                        {...restImageProps}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        className={`transition-transform duration-500 ${!isSelectMode && 'group-hover:scale-[1.02]'}`}
                      />

                      {isSelectMode && (
                        <div className="absolute top-3 left-3 z-20">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'bg-black/20 border-white/70 hover:bg-black/40'
                            }`}>
                            {isSelected && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </div>
                      )}

                      {!isSelectMode && (
                        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4 pointer-events-none">
                          <div className="text-white text-xs font-medium">
                            {hasMetadata ? (
                              <>
                                {pbData.camera && <span>{pbData.camera}</span>}
                                {pbData.camera && pbData.lens && <span className="mx-1">•</span>}
                                {pbData.lens && <span>{pbData.lens}</span>}
                              </>
                            ) : (
                              <span className="text-white/80 italic">View Photo</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {isUploadOpen && isAdmin && (
        <UploadModal
          onClose={() => setIsUploadOpen(false)}
          onUploadSuccess={fetchPhotos}
        />
      )}

      {/* Admin Login Modal */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-sm rounded-xl p-6 border border-border shadow-2xl">
            <h2 className="text-xl font-bold mb-6 text-foreground">Admin Login</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              {loginError && <p className="text-red-500 text-xs font-medium">{loginError}</p>}

              <div className="flex justify-end gap-3 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsLoginOpen(false)}
                  className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="bg-primary hover:bg-primary-hover disabled:bg-gray-400 px-6 py-2 rounded-lg text-white text-sm font-medium transition-colors"
                >
                  {isProcessing ? 'Logging in...' : 'Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox */}
      <div
        className={`fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 transition-all duration-300 ease-out ${isLightboxOpen
          ? 'bg-black/70 backdrop-blur-md opacity-100 visible'
          : 'bg-black/0 backdrop-blur-none opacity-0 invisible'
          }`}
        onClick={closeLightbox}
      >
        {lightboxPhoto && (
          <>
            <button
              className="absolute top-6 right-6 text-white/70 hover:text-white p-2 transition-colors z-10"
              onClick={closeLightbox}
              aria-label="Close lightbox"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <img
              src={pb.files.getURL(lightboxPhoto, lightboxPhoto.image)}
              alt="Full resolution"
              className={`max-h-[85vh] max-w-full object-contain shadow-2xl transition-transform duration-300 ease-out ${isLightboxOpen ? 'scale-100' : 'scale-95'
                }`}
              onClick={(e) => e.stopPropagation()}
            />

            <div
              className={`absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-3 md:gap-6 text-xs md:text-sm text-gray-200 bg-black/60 px-6 py-3 rounded-full backdrop-blur-lg border border-white/10 transition-all duration-300 delay-75 ${isLightboxOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
              onClick={(e) => e.stopPropagation()}
            >
              {lightboxPhoto.camera && (
                <span className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  {lightboxPhoto.camera}
                </span>
              )}
              {lightboxPhoto.lens && <span>{lightboxPhoto.lens}</span>}
              {lightboxPhoto.aperture && <span>ƒ/{lightboxPhoto.aperture}</span>}
              {lightboxPhoto.shutter_speed && <span>{lightboxPhoto.shutter_speed}s</span>}
              {lightboxPhoto.iso && <span>ISO {lightboxPhoto.iso}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}