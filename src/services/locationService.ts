import { ServiceLocation } from '../types';

export const getCurrentLocation = (): Promise<ServiceLocation> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada pelo navegador.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Reverse geocoding using OpenStreetMap (Nominatim)
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          const address = data.display_name;
          
          resolve({
            latitude,
            longitude,
            address
          });
        } catch (error) {
          console.error('Erro ao buscar endereço:', error);
          resolve({
            latitude,
            longitude,
            address: 'Endereço não encontrado'
          });
        }
      },
      (error) => {
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
};

export const getCoordinatesFromAddress = async (address: string): Promise<ServiceLocation> => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        address: data[0].display_name
      };
    }
    throw new Error('Endereço não encontrado');
  } catch (error) {
    console.error('Erro ao geocodificar endereço:', error);
    throw error;
  }
};

export const calculateDistance = (loc1: ServiceLocation, loc2: ServiceLocation): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
  const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(loc1.latitude * Math.PI / 180) * Math.cos(loc2.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in km
  return d;
};
