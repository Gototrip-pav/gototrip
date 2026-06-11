'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type MarkerPoint = {
  name: string;
  lat: number;
  lng: number;
};

type GoogleMapInstance = any;
type GoogleMarker = any;
type GoogleInfoWindow = any;

declare global {
  interface Window {
    google?: any;
    __gototripGoogleMapsPromise?: Promise<void>;
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('Google Maps ne peut être chargé que côté navigateur.')
    );
  }

  if (window.google?.maps) {
    return Promise.resolve();
  }

  if (window.__gototripGoogleMapsPromise) {
    return window.__gototripGoogleMapsPromise;
  }

  window.__gototripGoogleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-gototrip-google-maps="true"]'
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () =>
        reject(new Error('Impossible de charger Google Maps.'))
      );
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&language=fr&region=FR`;
    script.async = true;
    script.defer = true;
    script.dataset.gototripGoogleMaps = 'true';

    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Impossible de charger Google Maps.'));

    document.head.appendChild(script);
  });

  return window.__gototripGoogleMapsPromise;
}

function getCenter(markers: MarkerPoint[]) {
  const valid = markers.filter(
    (m) => Number.isFinite(Number(m.lat)) && Number.isFinite(Number(m.lng))
  );

  if (!valid.length) {
    return { lat: 48.8566, lng: 2.3522 };
  }

  const lat =
    valid.reduce((sum, m) => sum + Number(m.lat), 0) / valid.length;
  const lng =
    valid.reduce((sum, m) => sum + Number(m.lng), 0) / valid.length;

  return { lat, lng };
}

export default function TripMap({
  markers,
  height = 360,
  zoom = 12,
  showPath = false,
  focus,
}: {
  markers: MarkerPoint[];
  height?: number;
  zoom?: number;
  showPath?: boolean;
  focus?: MarkerPoint | null;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);
  const polylineRef = useRef<any | null>(null);
  const infoWindowRef = useRef<GoogleInfoWindow | null>(null);

  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string>('');

  const safeMarkers = useMemo(() => {
    return (markers || [])
      .map((m) => ({
        name: m.name || 'Lieu',
        lat: Number(m.lat),
        lng: Number(m.lng),
      }))
      .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
      .slice(0, 25);
  }, [markers]);

  useEffect(() => {
    if (!apiKey || apiKey === 'TA_CLE_API_GOOGLE_ICI') {
      setStatus('error');
      setErrorMessage('Carte Google non configurée dans .env.local.');
      return;
    }

    if (!mapDivRef.current) return;

    setStatus('loading');

    loadGoogleMaps(apiKey)
      .then(() => {
        if (!window.google?.maps || !mapDivRef.current) {
          throw new Error('Google Maps est indisponible.');
        }

        const center = getCenter(safeMarkers);

        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(mapDivRef.current, {
            center,
            zoom,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            clickableIcons: true,
            gestureHandling: 'greedy',
          });

          infoWindowRef.current = new window.google.maps.InfoWindow();
        }

        setStatus('ready');
      })
      .catch((error: any) => {
        setStatus('error');
        setErrorMessage(error?.message || 'Erreur inconnue Google Maps.');
      });
  }, [apiKey, safeMarkers, zoom]);

  useEffect(() => {
    if (status !== 'ready') return;
    if (!window.google?.maps) return;
    if (!mapRef.current) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (!safeMarkers.length) return;

    const bounds = new window.google.maps.LatLngBounds();

    safeMarkers.forEach((point, index) => {
      const isFocused =
        focus &&
        Math.abs(Number(focus.lat) - point.lat) < 0.000001 &&
        Math.abs(Number(focus.lng) - point.lng) < 0.000001;

      const marker = new window.google.maps.Marker({
        position: { lat: point.lat, lng: point.lng },
        map: mapRef.current,
        title: point.name,
        label: {
          text: isFocused ? '!' : String.fromCharCode(65 + (index % 26)),
          color: '#ffffff',
          fontWeight: '700',
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: isFocused ? 13 : 11,
          fillColor: isFocused ? '#dc2626' : '#0f766e',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      marker.addListener('click', () => {
        infoWindowRef.current?.setContent(`
          <div style="font-family: Arial, sans-serif; min-width: 160px;">
            <strong>${point.name}</strong>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">
              ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}
            </div>
          </div>
        `);
        infoWindowRef.current?.open(mapRef.current, marker);
      });

      markersRef.current.push(marker);
      bounds.extend({ lat: point.lat, lng: point.lng });
    });

    if (showPath && safeMarkers.length > 1 && !focus) {
      polylineRef.current = new window.google.maps.Polyline({
        path: safeMarkers.map((m) => ({ lat: m.lat, lng: m.lng })),
        geodesic: true,
        strokeColor: '#0f766e',
        strokeOpacity: 0.9,
        strokeWeight: 3,
      });

      polylineRef.current.setMap(mapRef.current);
    }

    if (focus && Number.isFinite(Number(focus.lat)) && Number.isFinite(Number(focus.lng))) {
      mapRef.current.setCenter({
        lat: Number(focus.lat),
        lng: Number(focus.lng),
      });
      mapRef.current.setZoom(15);
    } else if (safeMarkers.length === 1) {
      mapRef.current.setCenter({
        lat: safeMarkers[0].lat,
        lng: safeMarkers[0].lng,
      });
      mapRef.current.setZoom(zoom);
    } else {
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [status, safeMarkers, focus, showPath, zoom]);

  if (!safeMarkers.length) {
    return (
      <div
        className="rounded-2xl border border-slate-200 shadow-sm grid place-items-center text-slate-500 bg-slate-50"
        style={{ height }}
      >
        Aucun point reçu par la carte.
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700"
        style={{ height }}
      >
        <div className="font-bold mb-2">
          Impossible de charger la carte interactive
        </div>
        <div className="text-sm">{errorMessage}</div>

        <div className="mt-4 text-sm">
          Vérifie dans Google Cloud :
          <ul className="list-disc pl-5 mt-2">
            <li>Maps JavaScript API est activée.</li>
            <li>
              La clé utilisée par{' '}
              <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> autorise Maps
              JavaScript API.
            </li>
            <li>
              Les sites autorisés incluent{' '}
              <code>http://localhost:3000/*</code> et{' '}
              <code>http://localhost:3001/*</code>.
            </li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-slate-100"
      style={{ height }}
    >
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-white/80 text-sm text-slate-600">
          Chargement de la carte interactive...
        </div>
      )}

      <div ref={mapDivRef} className="h-full w-full" />
    </div>
  );
}