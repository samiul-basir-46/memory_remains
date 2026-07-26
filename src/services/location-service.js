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

/**
 * Detects whether an address is Inside Dhaka (৳60) or Outside Dhaka (৳110).
 * Handles division, district, upazila, and full street address checks to prevent user misselection.
 * 
 * @param {Object} loc
 * @param {string} loc.division
 * @param {string} loc.district
 * @param {string} loc.upazila
 * @param {string} loc.address
 * @returns {{ zone: 'inside_dhaka' | 'outside_dhaka', charge: number, label: string, isInside: boolean }}
 */
export function detectDeliveryZone({ division = '', district = '', upazila = '', address = '' } = {}) {
  const normDiv = (division || '').toString().trim().toLowerCase();
  const normDist = (district || '').toString().trim().toLowerCase();
  const normUp = (upazila || '').toString().trim().toLowerCase();
  const normAddr = (address || '').toString().trim().toLowerCase();

  const fullText = `${normDiv} ${normDist} ${normUp} ${normAddr}`;

  // Explicit non-Dhaka divisions
  if (normDiv && normDiv !== 'dhaka') {
    return { zone: 'outside_dhaka', charge: 110, label: 'Outside Dhaka', isInside: false };
  }

  // Keywords that belong to suburban areas outside Dhaka City / outer districts
  const outsideKeywords = [
    // Sub-urban / Outer Dhaka Upazilas
    'savar', 'dhamrai', 'keraniganj', 'dohar', 'nawabganj', 'nawab ganj',
    'gazipur', 'narayanganj', 'tongali', 'tongi', 'board bazar', 'chattogram', 'chittagong',
    'sylhet', 'rajshahi', 'khulna', 'barishal', 'barisal', 'rangpur', 'mymensingh',
    'comilla', 'cumilla', 'bogura', 'bogra', 'noakhali', 'feni', 'cox', 'jessore',
    'yessore', 'pabna', 'kushtia', 'tangail', 'faridpur', 'dinajpur', 'jamalpur',
    'shariatpur', 'madaripur', 'gopalganj', 'manikganj', 'munshiganj', 'narail',
    'magura', 'jhenaidah', 'satkhira', 'bagerhat', 'chuadanga', 'meherpur', 'natore',
    'naogaon', 'joypurhat', 'chapainawabganj', 'sirajganj', 'gaibandha', 'kurigram',
    'lalmonirhat', 'nilphamari', 'panchagarh', 'thakurgaon', 'habiganj', 'moulvibazar',
    'sunamganj', 'bramhanbaria', 'brahmanbaria', 'chandpur', 'lakshmipur', 'barguna',
    'bhola', 'jhalokati', 'patuakhali', 'pirojpur', 'bandarban', 'khagrachhari',
    'rangamati', 'sherpur', 'netrokona', 'kishoreganj'
  ];

  if (normDist && !['dhaka', 'dhaka city', 'dhakacity', 'dhaka.'].includes(normDist)) {
    return { zone: 'outside_dhaka', charge: 110, label: 'Outside Dhaka', isInside: false };
  }

  const hasOutsideKeyword = outsideKeywords.some((kw) => fullText.includes(kw));
  if (hasOutsideKeyword) {
    return { zone: 'outside_dhaka', charge: 110, label: 'Outside Dhaka', isInside: false };
  }

  return { zone: 'inside_dhaka', charge: 60, label: 'Inside Dhaka', isInside: true };
}
