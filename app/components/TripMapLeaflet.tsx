'use client';

import React, { useEffect, useMemo } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type TripMapMarker = {
  id?: string;
  name?: string;
  title?: string;
  label?: string;
  address?: string;
  lat: number;
  lng: number;
};

type TripMapLeafletProps = {
  markers?: TripMapMarker[];
  height?: number | string;
  zoom?: number;
  showPath?: boolean;
  className?: string;
};

const LeafletMapContainer = MapContainer as any;
const LeafletTileLayer = TileLayer as any;
const LeafletMarker = Marker as any;
const LeafletPopup = Popup as any;
const LeafletPolyline = Polyline as any;

function isValidCoordinate(marker: TripMapMarker) {
  return Number.isFinite(Number(marker.lat)) && Number.isFinite(Number(marker.lng));
}

function getMarkerName(marker: TripMapMarker, index: number) {
  return marker.name || marker.title || marker.label || `Point ${index + 1}`;
}

function createMarkerIcon(index: number) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 9999px;
        background: #0f766e;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 800;
        border: 2px solid white;
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.25);
      ">
        ${index + 1}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function getMapCenter(markers: TripMapMarker[]) {
  if (markers.length === 0) {
    return {
      lat: 48.8566,
      lng: 2.3522,
    };
  }

  const sum = markers.reduce(
    (acc, marker) => {
      acc.lat += Number(marker.lat);
      acc.lng += Number(marker.lng);
      return acc;
    },
    {
      lat: 0,
      lng: 0,
    }
  );

  return {
    lat: sum.lat / markers.length,
    lng: sum.lng / markers.length,
  };
}

function FitBounds({ markers }: { markers: TripMapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (!markers.length) return;

    if (markers.length === 1) {
      map.setView([Number(markers[0].lat), Number(markers[0].lng)], 13);
      return;
    }

    const bounds = L.latLngBounds(
      markers.map((marker) => [Number(marker.lat), Number(marker.lng)])
    );

    map.fitBounds(bounds, {
      padding: [32, 32],
      maxZoom: 13,
    });
  }, [map, markers]);

  return null;
}

export default function TripMapLeaflet({
  markers = [],
  height = 320,
  zoom = 12,
  showPath = false,
  className = '',
}: TripMapLeafletProps) {
  const cleanMarkers = useMemo(() => {
    return markers.filter(isValidCoordinate);
  }, [markers]);

  const center = useMemo(() => getMapCenter(cleanMarkers), [cleanMarkers]);

  const mapHeight =
    typeof height === 'number'
      ? `${height}px`
      : height || '320px';

  const pathPositions = cleanMarkers.map((marker) => [
    Number(marker.lat),
    Number(marker.lng),
  ]);

  if (cleanMarkers.length === 0) {
    return (
      <div
        className={`grid place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500 ${className}`}
        style={{ height: mapHeight }}
      >
        Carte indisponible : aucun point à afficher.
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 ${className}`}
      style={{ height: mapHeight }}
    >
      <LeafletMapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{
          height: '100%',
          width: '100%',
        }}
      >
        <LeafletTileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds markers={cleanMarkers} />

        {showPath && pathPositions.length >= 2 && (
          <LeafletPolyline positions={pathPositions} />
        )}

        {cleanMarkers.map((marker, index) => (
          <LeafletMarker
            key={`${getMarkerName(marker, index)}-${marker.lat}-${marker.lng}-${index}`}
            position={[Number(marker.lat), Number(marker.lng)]}
            icon={createMarkerIcon(index)}
          >
            <LeafletPopup>
              <div className="text-sm">
                <div className="font-semibold">
                  {getMarkerName(marker, index)}
                </div>

                {marker.address && (
                  <div className="mt-1 text-xs text-slate-600">
                    {marker.address}
                  </div>
                )}
              </div>
            </LeafletPopup>
          </LeafletMarker>
        ))}
      </LeafletMapContainer>
    </div>
  );
}