/**
 * Memory Remains - Location Service
 * Provides Geolocation API & Reverse Geocoding support for Bangladesh delivery locations.
 */

export async function getCurrentGpsLocation() {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by your browser');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=en`,
            { headers: { 'User-Agent': 'MemoryRemainsApp/1.0' } }
          );

          if (!response.ok) throw new Error('Failed to fetch address details');
          const data = await response.json();
          const addr = data.address || {};

          // Determine Bangladesh Division
          let division = 'Dhaka';
          const stateStr = (addr.state || addr.region || addr.county || '').toLowerCase();
          if (stateStr.includes('chattogram') || stateStr.includes('chittagong')) division = 'Chattogram';
          else if (stateStr.includes('rajshahi')) division = 'Rajshahi';
          else if (stateStr.includes('khulna')) division = 'Khulna';
          else if (stateStr.includes('barishal') || stateStr.includes('barisal')) division = 'Barishal';
          else if (stateStr.includes('sylhet')) division = 'Sylhet';
          else if (stateStr.includes('rangpur')) division = 'Rangpur';
          else if (stateStr.includes('mymensingh')) division = 'Mymensingh';

          const district = addr.city || addr.town || addr.county || addr.state_district || 'Dhaka';
          const upazila = addr.suburb || addr.quarter || addr.neighbourhood || addr.subdistrict || addr.city_district || addr.town || '';
          const road = addr.road || addr.pedestrian || addr.footway || '';
          const house = addr.house_number || addr.building || '';

          let detailedAddress = '';
          if (house && road) detailedAddress = `House ${house}, ${road}`;
          else if (road) detailedAddress = road;
          else detailedAddress = data.display_name ? data.display_name.split(',').slice(0, 3).join(', ') : '';

          const postalCode = addr.postcode || '';

          resolve({
            division,
            district,
            upazila: upazila || district,
            address: detailedAddress || `${upazila || district}, ${division}`,
            postalCode,
            latitude: lat,
            longitude: lon,
            displayName: data.display_name || ''
          });
        } catch (err) {
          console.warn('Reverse geocode fallback:', err);
          resolve({
            division: 'Dhaka',
            district: 'Dhaka',
            upazila: '',
            address: `GPS (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)})`,
            postalCode: '',
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        }
      },
      (error) => {
        let msg = 'Unable to detect GPS location.';
        if (error.code === error.PERMISSION_DENIED) msg = 'GPS Permission denied by browser.';
        else if (error.code === error.POSITION_UNAVAILABLE) msg = 'Location signal unavailable.';
        else if (error.code === error.TIMEOUT) msg = 'Location request timed out.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}
