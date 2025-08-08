
import axios from 'axios';
import {
NearbyPlacesResponse,
ReverseGeocodeResult,
GeocodeResponse,
RouteResponse,
ETAMatrixResponse,
} from '../components/types';

const API_KEY = 'AIzaSyC2CoAFolpCsbZIH7WmwFqEv1Ska1vto5w';
const BASE_URL = 'https://maps.googleapis.com/maps/api';

// Geocode (address → lat/lng)
export const geocodeAddress = async (address: string): Promise<GeocodeResponse> => {
const response = await axios.get<GeocodeResponse>(`${BASE_URL}/geocode/json`, {
params: {
address,
key: API_KEY,
},
});
return response.data;
};

// Reverse Geocode (lat/lng → address)
export const reverseGeocode = async (
lat: number,
lng: number
): Promise<ReverseGeocodeResult> => {
const response = await axios.get<ReverseGeocodeResult>(`${BASE_URL}/geocode/json`, {
params: {
latlng: `${lat},${lng}`,
key: API_KEY,
},
});
return response.data;
};

// Directions
export const getRoute = async (
origin: string,
destination: string
): Promise<RouteResponse> => {
const response = await axios.get<RouteResponse>(`${BASE_URL}/directions/json`, {
params: {
origin,
destination,
key: API_KEY,
},
});
return response.data;
};

// Distance Matrix (ETA)
export const getETAMatrix = async (
origins: string,
destinations: string
): Promise<ETAMatrixResponse> => {
const response = await axios.get<ETAMatrixResponse>(`${BASE_URL}/distancematrix/json`, {
params: {
origins,
destinations,
key: API_KEY,
},
});
return response.data;
};

// Nearby Places
export const getNearbyPlaces = async (
lat: number,
lng: number,
radius = 2000,
type = 'store'
): Promise<NearbyPlacesResponse> => {
const response = await axios.get<NearbyPlacesResponse>(
`${BASE_URL}/place/nearbysearch/json`,
{
params: {
location: `${lat},${lng}`,
radius,
type,
key: API_KEY,
},
}
);
return response.data;
};

// Autocomplete
type AutocompleteResponse = {
predictions: { description: string }[];
};

export const getAutocompleteSuggestions = async (
input: string
): Promise<{ description: string }[]> => {
const response = await axios.get<AutocompleteResponse>(
`${BASE_URL}/place/autocomplete/json`,
{
params: {
input,
key: API_KEY,
},
}
);
return response.data.predictions || [];
};

// Snap to Road (stub type)
type SnapToRoadResponse = {
snappedPoints: {
location: {
latitude: number;
longitude: number;
};
placeId?: string;
}[];
};

export const snapToRoad = async (path: string): Promise<SnapToRoadResponse> => {
const response = await axios.get<SnapToRoadResponse>(`${BASE_URL}/snapToRoad`, {
params: { path, key: API_KEY },
});
return response.data;
};

// Optimized Route (multi-stop)
export const getOptimizedRoute = async (
waypoints: string[]
): Promise<RouteResponse> => {
const response = await axios.get<RouteResponse>(`${BASE_URL}/directions/json`, {
params: {
waypoints: waypoints.join('|'),
key: API_KEY,
},
});
return response.data;
};
