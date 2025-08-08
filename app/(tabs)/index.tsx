import React, { useEffect, useRef, useState } from 'react';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline, LatLng } from 'react-native-maps';
import { StyleSheet, TouchableOpacity, View, Text, TextInput, Platform, SafeAreaView, ScrollView, Animated, Image } from 'react-native';
import { useNavigation } from 'expo-router';
import * as Location from 'expo-location';
import polyline from '@mapbox/polyline';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


import {
  geocodeAddress,
  reverseGeocode,
  getRoute,
  getNearbyPlaces,
  getETAMatrix,
  getAutocompleteSuggestions,
} from '../../components/requests';

import { Locations as LocationIcon } from '../../assets/icons/location';
import CustomBottomSheet from '../../components/bottomsheet';


const decodePolyline = (encoded: string) =>
  polyline.decode(encoded).map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

const INITIAL_REGION = {
  latitude: 18.478006,
  longitude: 73.889983,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function App() {
  const mapRef = useRef<MapView>(null);
  const navigation = useNavigation();
  const [manualMode, setManualMode] = useState(false);
  const [manualPin, setManualPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<{ description: string }[]>([]);
  const [searchMarker, setSearchMarker] = useState<{ latitude: number; longitude: number } | null>(null);
  const [longPressMarker, setLongPressMarker] = useState<{ latitude: number; longitude: number } | null>(null);
  const [polylineCoords, setPolylineCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [nearbyShops, setNearbyShops] = useState<
    { id: string; name: string; latitude: number; longitude: number }[]
  >([]);
  const [isSheetVisible, setSheetVisible] = useState(false);
  const [shopEtas, setShopEtas] = useState<
    { name: string; latitude: number; longitude: number; eta: string; distance: string }[]
  >([]);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    getLocationPermission();
  }, []);

  const getLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;
    setUserLocation({ latitude, longitude });

    try {
      const result = await reverseGeocode(latitude, longitude);
      if (Array.isArray(result.results) && result.results.length > 0) {
        setFromText(result.results[0].formatted_address);
      } else if (result.formatted_address) {
        setFromText(result.formatted_address);
      }
    } catch (err) {
      console.warn('Reverse geocode failed:', err);
    }

    mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
    await showNearbyShops(latitude, longitude);
  };

  const showNearbyShops = async (lat: number, lng: number) => {
    try {
      const res = await getNearbyPlaces(lat, lng);
      const places = res.results.map((place: any, index: number) => ({
        id: place.place_id || `${index}`,
        name: place.name,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
      }));
      const top10 = places.slice(0, 10);
      setNearbyShops(top10);

      const etaRes = await getETAMatrix(
        `${lat},${lng}`,
        top10.map((p) => `${p.latitude},${p.longitude}`).join('|')
      );

      const updated = top10.map((p, i) => ({
        ...p,
        eta: etaRes.rows[0].elements[i].duration.text,
        distance: etaRes.rows[0].elements[i].distance.text,
      }));
      setShopEtas(updated);
      setSheetVisible(true);
    } catch (err) {
      console.warn('Nearby shop fetch failed:', err);
    }
  };

  const handleSearch = async () => {
    try {
      const res = await geocodeAddress(toText);
      if (!res.results.length) return;
      const loc = res.results[0].geometry.location;
      const coord = { latitude: loc.lat, longitude: loc.lng };
      setSearchMarker(coord);
      setSearchSuggestions([]);
      mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
      await drawRoute(coord);
      await showNearbyShops(coord.latitude, coord.longitude);
    } catch (err) {
      console.warn('Search failed:', err);
    }
  };

  // const handleMapLongPress = async (e: LongPressEvent) => {
  //   const { latitude, longitude } = e.nativeEvent.coordinate;
  //   const marker = { latitude, longitude };
  //   setLongPressMarker(marker);
  //   setPolylineCoords([]);
  //   await drawRoute(marker);
  // };

  const drawRoute = async (destination: { latitude: number; longitude: number }) => {
    if (!userLocation || !destination) return;

    try {
      const res = await getRoute(
        `${userLocation.latitude},${userLocation.longitude}`,
        `${destination.latitude},${destination.longitude}`
      );
      const points = res.routes[0].overview_polyline.points;
      setPolylineCoords(decodePolyline(points));

      const etaRes = await getETAMatrix(
        `${userLocation.latitude},${userLocation.longitude}`,
        `${destination.latitude},${destination.longitude}`
      );
      const { duration, distance } = etaRes.rows[0].elements[0];
      setRouteInfo({ duration: duration.text, distance: distance.text });
    } catch (err) {
      console.warn('Route/ETA failed:', err);
    }
  };

  const clearRoute = () => {
    setPolylineCoords([]);
    setRouteInfo(null);
    setSearchMarker(null);
    setLongPressMarker(null);
    setManualPin(null);
    setDestination(null);
  };

  const drawRouteToShop = async (shop: { latitude: number; longitude: number }) => {
    setSearchMarker(shop);
    await drawRoute(shop);
  };

  const fetchAutocomplete = async (input: string) => {
    if (input.length < 2) {
      setSearchSuggestions([]);
      return;
    }
    try {
      const suggestions = await getAutocompleteSuggestions(input);
      setSearchSuggestions(suggestions);
    } catch (err) {
      console.warn('Autocomplete failed:', err);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* FROM input */}
        <View style={styles.searchContainer}>
          <LocationIcon color="#1F1F1F" />
          <TextInput
            placeholder="From (your location)"
            value={fromText}
            editable={true}
            style={styles.searchInput}
          />
        </View>

        {/* TO input */}
        <View style={[styles.searchContainer, { top: Platform.OS === 'ios' || 'android' ? 100 : 80 }]}>
          <LocationIcon color="#1F1F1F" />
          <TextInput
            placeholder="To (search destination)"
            value={toText}
            onChangeText={(text) => {
              setToText(text);
              fetchAutocomplete(text);
            }}
            onSubmitEditing={handleSearch}
            style={styles.searchInput}
          />
          <TouchableOpacity onPress={handleSearch}>
            <Text style={styles.searchButton}>Go</Text>
          </TouchableOpacity>
        </View>

        {/* Autocomplete dropdown */}
        {searchSuggestions.length > 0 && (
          <View style={styles.suggestionBox}>
            {searchSuggestions.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionItem}
                onPress={async () => {
                  setToText(item.description);
                  setSearchSuggestions([]);
                  await handleSearch();
                }}
              >
                <Text style={{ color: '#000' }}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Map */}
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_GOOGLE}
          initialRegion={INITIAL_REGION}
          showsTraffic
          showsIndoors
          showsUserLocation
          showsPointsOfInterest
          // onLongPress={handleMapLongPress}
        >
          {searchMarker && <Marker coordinate={searchMarker} title="Destination" pinColor="blue" />}
          {longPressMarker && (
            <Marker
              coordinate={longPressMarker}
              title="Pinned Location"
              draggable
              onDragEnd={(e) => setLongPressMarker(e.nativeEvent.coordinate)}
            />
          )}
          {nearbyShops.map((shop) => (
            <Marker
              key={shop.id}
              coordinate={{ latitude: shop.latitude, longitude: shop.longitude }}
              title={shop.name}
              pinColor="green"
              onPress={() => drawRouteToShop(shop)}
            />
          ))}
          {destination && (
            <Marker
              coordinate={destination}
              title={manualAddress}
              description={manualAddress}         
              pinColor="red"
            />
          )}

          {manualMode && manualPin && (
            <Marker
            coordinate={manualPin}
            draggable
            title="Set Destination"
            pinColor="red"
            onDragEnd={async (e) => {
              const newCoord = e.nativeEvent.coordinate;
              setManualPin(newCoord);
              try {
                const result = await reverseGeocode(newCoord.latitude, newCoord.longitude);
                const address = Array.isArray(result.results) && result.results.length > 0
                  ? result.results[0].formatted_address
                  : result.formatted_address || '';
                setManualAddress(address); // Preview before confirm
              } catch (err) {
                console.warn('Reverse geocode failed for manual pin:', err);
                setManualAddress('');
              }
            }}
          />
          )}

          {polylineCoords.length > 0 && (
            <Polyline coordinates={polylineCoords} strokeColor="#007AFF" strokeWidth={4} />
          )}
        </MapView>

        {routeInfo && (
          <View style={styles.routeInfoTile}>
            <Text style={styles.routeInfoText}>
              Distance: {routeInfo.distance} | ETA: {routeInfo.duration}
            </Text>
          </View>
        )}

        {/* Locate Me */}
        <TouchableOpacity
          onPress={getLocationPermission}
          style={{
            position: 'absolute',
            top: Platform.OS === 'android' ? 160 : 140,
            right: 20,
            backgroundColor: '#fff',
            padding: 10,
            borderRadius: 50,
            elevation: 5,
            zIndex: 1000,
          }}
        >
          <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>Locate Me</Text>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={{ position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 20, left: 10 }}>
          <TouchableOpacity onPress={() => drawRoute(searchMarker || longPressMarker!)} style={styles.button}>
            <Text style={styles.buttonText}>Draw Route</Text>
          </TouchableOpacity>
          <TouchableOpacity
              onPress={() => {
                if (userLocation) {
                  const pin = {
                   latitude: userLocation.latitude + 0.001, // small offset to see pin
                    longitude: userLocation.longitude,
                  };
                  setManualMode(true);
                  setManualPin(pin);
                mapRef.current?.animateToRegion({ ...pin, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
                }
              }}
              style={[styles.button, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.buttonText}>Locate Manually</Text>
            </TouchableOpacity>
            {manualMode && manualPin && manualAddress !== '' && (
              <Animated.View
              // entering={FadeInUp.duration(300)}
              // exiting={FadeOutDown.duration(300)}
              style={styles.snackbar}
              >
              <Text style={styles.snackbarText} numberOfLines={2}>
                📍 {manualAddress}
              </Text>
              <TouchableOpacity
                onPress={async () => {
                  if (!manualPin) return;
                  setToText(manualAddress);
                  setDestination(manualPin);
                  await drawRoute(manualPin);
                  setManualMode(false);
                  setManualPin(null);
                  setManualAddress('');
                }}
                style={styles.snackbarButton}
              >
                <Text style={styles.snackbarButtonText}>Confirm</Text>
              </TouchableOpacity>

              </Animated.View>
            )}

          <TouchableOpacity
            onPress={() =>
              userLocation && showNearbyShops(userLocation.latitude, userLocation.longitude)
            }
            style={styles.button}
          >
            <Text style={styles.buttonText}>Show Nearby Shops</Text>
          </TouchableOpacity>
          {polylineCoords.length > 0 && (
            <TouchableOpacity onPress={clearRoute} style={[styles.button, { backgroundColor: '#FF3B30' }]}>
              <Text style={styles.buttonText}>Clear Route</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom Sheet */}
        <CustomBottomSheet visible={isSheetVisible} onClose={() => setSheetVisible(false)}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 10 }}>
            Nearby Shops (ETA from your location)
          </Text>
          {shopEtas.map((shop, index) => (
            <View
              key={index}
              style={{ marginBottom: 10, padding: 10, backgroundColor: '#f5f5f5', borderRadius: 8 }}
            >
              <TouchableOpacity onPress={() => drawRouteToShop(shop)} style={[styles.button, { backgroundColor: '#d7eecfff' }]}>
              <Text style={{ fontWeight: 'bold' }}>{shop.name}</Text>
              <Text>ETA: {shop.eta} | Distance: {shop.distance}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{outlineColor: '#489689', backgroundColor:'#f7f7f7'}}>
                
              </TouchableOpacity>
            </View>
          ))}
        </CustomBottomSheet>
        </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff', // or your background
  },
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 50 : 50,
    left: 15,
    right: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    elevation: 8,
    zIndex: 999,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#000',
  },
  searchButton: {
    paddingHorizontal: 10,
    fontWeight: '600',
    color: '#007AFF',
  },
  suggestionBox: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 140 : 120,
    left: 15,
    right: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 4,
    zIndex: 1000,
    elevation: 6,
  },
  suggestionItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
  },
  button: {
    backgroundColor: '#121415ff',
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
    width: 180,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  routeInfoTile: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 200 : 180,
    alignSelf: 'center',
    backgroundColor: '#ede880',
    padding: 10,
    borderRadius: 8,
    elevation: 4,
    zIndex: 1000,
  },
  routeInfoText: {
    color: '#000',
    fontWeight: '600',
  },
  confirmContainer: {
    position: 'absolute',
    bottom: 180,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    alignItems: 'center',
  },
  addressPreview: {
    fontSize: 14,
    marginBottom: 8,
    color: '#333',
    textAlign: 'center',
  },
  snackbar: {
    position: 'absolute',
    bottom: 140,
    left: 3,
    right: 3,
    backgroundColor: '#333',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  snackbarText: {
    color: 'white',
    flex: 1,
    marginRight: 10,
    fontSize: 14,
  },
  snackbarButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 5,
    borderRadius: 10,
    left: 10

  },
  snackbarButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    padding:12
  }
  
  
});
