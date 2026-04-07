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
