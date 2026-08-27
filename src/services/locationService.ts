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
        let message = 'Erro desconhecido ao obter localização.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Permissão de geolocalização negada pelo usuário.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Informações de localização indisponíveis.';
            break;
          case error.TIMEOUT:
            message = 'Tempo esgotado ao tentar obter localização.';
            break;
        }
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
};

export const getCoordinatesFromAddress = async (address: string): Promise<ServiceLocation> => {
  const fetchCoordinates = async (query: string) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'User-Agent': 'ServiceOrderApp/1.0'
        }
      }
    );
    return await response.json();
  };

  try {
    // 1. Try full address
    let data = await fetchCoordinates(address);
    
    // 2. If not found and contains commas, try stripping the first part (often a specific number or room)
    if ((!data || data.length === 0) && address.includes(',')) {
      const parts = address.split(',');
      if (parts.length > 1) {
        const fallbackAddress = parts.slice(1).join(',').trim();
        data = await fetchCoordinates(fallbackAddress);
      }
    }

    // 3. If still not found, try a very basic street/city search if formatted like "Street, City - State"
    if ((!data || data.length === 0) && address.includes('-')) {
      const parts = address.split('-');
      if (parts.length > 0) {
        data = await fetchCoordinates(parts[0].trim());
      }
    }
    
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        address: data[0].display_name
      };
    }
    throw new Error('Endereço não encontrado. Tente um formato mais simples (Rua, Cidade, Estado).');
  } catch (error) {
    console.error('Erro ao geocodificar endereço:', error);
    if (error instanceof Error && error.message.includes('Endereço não encontrado')) {
      throw error;
    }
    throw new Error('Erro de conexão ao buscar endereço. Verifique sua internet.');
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
