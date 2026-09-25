import { useEffect, useRef, useState } from 'react';

const DEFAULT_CENTER = { lat: 23.7508, lng: 90.3911 };
const DEFAULT_ZOOM = 14;

let mapsLoaderPromise;

const loadGoogleMaps = (apiKey) => {
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
        return Promise.resolve(window.google.maps);
    }
    if (mapsLoaderPromise) {
        return mapsLoaderPromise;
    }
    mapsLoaderPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(window.google.maps);
        script.onerror = () => reject(new Error('Google Maps failed to load'));
        document.head.appendChild(script);
    });
    return mapsLoaderPromise;
};

const LocationPicker = ({ value, onLocationSelect }) => {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const userMarkerRef = useRef(null);
    const clickListenerRef = useRef(null);
    const markerDragListenerRef = useRef(null);
    const [status, setStatus] = useState('loading');
    const onSelectRef = useRef(onLocationSelect);
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const [currentLocation, setCurrentLocation] = useState(null);

    useEffect(() => {
        onSelectRef.current = onLocationSelect;
    }, [onLocationSelect]);

    const placeMarker = (coords) => {
        if (!mapRef.current || !window.google?.maps) return;

        if (!markerRef.current) {
            markerRef.current = new window.google.maps.Marker({
                position: coords,
                map: mapRef.current,
                draggable: true
            });
            markerDragListenerRef.current = markerRef.current.addListener('dragend', (event) => {
                if (!event.latLng) return;
                const nextCoords = { lat: event.latLng.lat(), lng: event.latLng.lng() };
                if (onSelectRef.current) {
                    onSelectRef.current(nextCoords);
                }
            });
        } else {
            markerRef.current.setPosition(coords);
        }
    };

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setCurrentLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.log("Error getting location", error);
                }
            );
        }
    }, []);

    useEffect(() => {
        let isActive = true;

        if (!apiKey) {
            setStatus('missing-key');
            return () => { };
        }

        loadGoogleMaps(apiKey)
            .then(() => {
                if (!isActive || !containerRef.current) {
                    return;
                }
                if (!mapRef.current) {
                    const center = value ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER;

                    mapRef.current = new window.google.maps.Map(containerRef.current, {
                        center,
                        zoom: DEFAULT_ZOOM,
                        clickableIcons: false,
                        gestureHandling: 'greedy',
                        mapTypeControl: false,
                        fullscreenControl: false,
                        streetViewControl: false,
                        styles: [
                            { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
                            { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
                            { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
                            { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
                            { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
                            { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
                            { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
                            { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
                            { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
                            { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
                            { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
                            { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
                            { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
                            { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#2f3948" }] },
                            { "featureType": "transit.station", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
                            { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
                            { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
                            { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
                        ]
                    });

                    clickListenerRef.current = mapRef.current.addListener('click', (event) => {
                        if (!event.latLng) return;
                        const coords = { lat: event.latLng.lat(), lng: event.latLng.lng() };
                        placeMarker(coords);
                        mapRef.current.panTo(coords);
                        if (onSelectRef.current) {
                            onSelectRef.current(coords);
                        }
                    });

                    if (value) {
                        placeMarker({ lat: value.lat, lng: value.lng });
                    }
                }

                setStatus('ready');
            })
            .catch(() => {
                if (isActive) {
                    setStatus('error');
                }
            });

        return () => {
            isActive = false;
            if (clickListenerRef.current) {
                clickListenerRef.current.remove();
                clickListenerRef.current = null;
            }
            if (markerDragListenerRef.current) {
                markerDragListenerRef.current.remove();
                markerDragListenerRef.current = null;
            }
            if (markerRef.current) {
                markerRef.current.setMap(null);
                markerRef.current = null;
            }
            if (userMarkerRef.current) {
                userMarkerRef.current.setMap(null);
                userMarkerRef.current = null;
            }
        };
    }, [apiKey]);

    useEffect(() => {
        if (!mapRef.current || !window.google?.maps) return;

        if (currentLocation) {
            const userIcon = {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: '#3B82F6',
                fillOpacity: 0.9,
                strokeColor: '#E5E7EB',
                strokeWeight: 2
            };
            if (!userMarkerRef.current) {
                userMarkerRef.current = new window.google.maps.Marker({
                    position: currentLocation,
                    map: mapRef.current,
                    icon: userIcon,
                    title: 'Your location'
                });
            } else {
                userMarkerRef.current.setPosition(currentLocation);
            }

            if (!value) {
                mapRef.current.setCenter(currentLocation);
            }
        }
    }, [currentLocation, value]);

    useEffect(() => {
        if (!mapRef.current || !window.google?.maps) return;

        if (!value) {
            if (markerRef.current) {
                markerRef.current.setMap(null);
                markerRef.current = null;
            }
            return;
        }

        const coords = { lat: value.lat, lng: value.lng };
        placeMarker(coords);
        mapRef.current.panTo(coords);
    }, [value]);

    const handleUseMyLocation = () => {
        if (!currentLocation || !mapRef.current) return;
        mapRef.current.panTo(currentLocation);
        placeMarker(currentLocation);
        if (onSelectRef.current) {
            onSelectRef.current(currentLocation);
        }
    };

    return (
        <div className="h-full w-full relative rounded-2xl overflow-hidden border border-gray-700 shadow-inner">
            <div ref={containerRef} className="h-full w-full cursor-crosshair" />

            <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={!currentLocation}
                className="absolute top-4 right-4 z-10 bg-black/80 hover:bg-black text-white px-3 py-2 rounded-lg border border-white/10 shadow-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Use my location
            </button>

            {/* Coordinate Overlay */}
            <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-lg border border-white/10 shadow-lg text-xs font-mono space-y-1">
                {value ? (
                    <>
                        <div className="flex items-center gap-2">
                            <span className="text-primary-gold font-bold">LAT:</span>
                            <span>{value.lat.toFixed(6)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-primary-gold font-bold">LNG:</span>
                            <span>{value.lng.toFixed(6)}</span>
                        </div>
                    </>
                ) : (
                    <span className="text-gray-400 italic">Click on map to select location</span>
                )}
            </div>

            {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-300 bg-black/40">
                    Loading map...
                </div>
            )}
            {status === 'missing-key' && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-red-300 bg-black/40">
                    Missing Google Maps API key.
                </div>
            )}
            {status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-red-300 bg-black/40">
                    Map failed to load.
                </div>
            )}
        </div>
    );
};

export default LocationPicker;
