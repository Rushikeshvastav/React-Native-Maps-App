
// For nearby places
export type PlaceResult = {
id?: string;
name: string;
latitude: number;
longitude: number;
address?: string;
[key: string]: any;
};

export type NearbyPlacesResponse = {
results: PlaceResult[];
};

// For reverse geocoding
export type ReverseGeocodeResult = {
formatted_address: string;
latitude: number;
longitude: number;
[key: string]: any;
};

export type GeocodeResponse = {
results: {
geometry: {
location: {
lat: number;
lng: number;
};
};
formatted_address: string;
place_id: string;
}[];
status: string;
};

// For routing (directions)
export type RouteResponse = {
routes: {
overview_polyline: {
points: string;
};
legs?: any[];
summary?: string;
}[];
};

// For ETA matrix
export type ETAMatrixResponse = {
rows: {
elements: {
duration: { text: string; value: number };
distance: { text: string; value: number };
status: string;
}[];
}[];
};
