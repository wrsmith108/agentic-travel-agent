/**
 * Test script for flight search API
 * Run with: npx tsx src/utils/testFlightSearch.ts
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = 'http://localhost:3001/api/v1';
let accessToken: string;

async function authenticate(): Promise<boolean> {
  console.log('🔐 Authenticating...');
  
  const testEmail = `flighttest-${uuidv4().slice(0, 8)}@example.com`;
  const testPassword = 'FlightTest123!';
  
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, {
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
      firstName: 'Flight',
      lastName: 'Tester',
      acceptTerms: true,
      marketingOptIn: false,
    });
    
    if (response.data.success) {
      accessToken = response.data.data.accessToken;
      console.log('✅ Authentication successful\n');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    return false;
  }
}

async function testFlightSearch() {
  console.log('✈️ Testing Flight Search API\n');
  
  // Test 1: Search flights (JFK to LAX)
  console.log('1️⃣ Searching flights from JFK to LAX...');
  try {
    const departureDate = new Date();
    departureDate.setDate(departureDate.getDate() + 30); // 30 days from now
    
    const searchRequest = {
      origin: 'JFK',
      destination: 'LAX',
      departureDate: departureDate().toISOString().split('T')[0],
      adults: 1,
      travelClass: 'ECONOMY',
      nonStop: false,
      currencyCode: 'USD',
      maxResults: 5,
    };
    
    console.log('Search params:', searchRequest);
    
    const response = await axios.post(
      `${API_BASE_URL}/flights/search`,
      searchRequest,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (response.data.success) {
      console.log('✅ Flight search successful');
      console.log(`   Found ${response.data.data.count} flights`);
      
      response.data.data.flights.slice(0, 3).forEach((flight: any, index: number) => {
        console.log(`\n   Flight ${index + 1}:`);
        console.log(`   ${flight.origin} → ${flight.destination}`);
        console.log(`   Departure: ${new Date(flight.departureTime).toLocaleString()}`);
        console.log(`   Duration: ${flight.duration}`);
        console.log(`   Stops: ${flight.stops}`);
        console.log(`   Carrier: ${flight.carrierName} (${flight.carrier})`);
        console.log(`   Price: ${flight.price.formatted}`);
        console.log(`   Available seats: ${flight.bookableSeats}`);
      });
    }
  } catch (error: any) {
    console.error('❌ Flight search failed:', error.response?.data || error.message);
  }
  
  // Test 2: Quick search with return flight
  console.log('\n\n2️⃣ Quick search: NYC to London (round trip)...');
  try {
    const departureDate = new Date();
    departureDate.setDate(departureDate.getDate() + 60); // 60 days from now
    const returnDate = new Date(departureDate);
    returnDate.setDate(returnDate.getDate() + 7); // 7 days later
    
    const quickSearchRequest = {
      from: 'NYC',
      to: 'LON',
      when: departureDate().toISOString(),
      returnWhen: returnDate().toISOString(),
      travelers: 2,
    };
    
    const response = await axios.post(
      `${API_BASE_URL}/flights/quick-search`,
      quickSearchRequest,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (response.data.success) {
      console.log('✅ Quick search successful');
      console.log(`   Found ${response.data.data.count} flight options`);
      console.log(`   Search: ${response.data.data.search.from} → ${response.data.data.search.to}`);
      console.log(`   Dates: ${response.data.data.search.departureDate} to ${response.data.data.search.returnDate}`);
      console.log(`   Travelers: ${response.data.data.search.travelers}`);
    }
  } catch (error: any) {
    console.error('❌ Quick search failed:', error.response?.data || error.message);
  }
  
  // Test 3: Search airports
  console.log('\n\n3️⃣ Searching airports containing "Paris"...');
  try {
    const response = await axios.get(
      `${API_BASE_URL}/flights/airports?keyword=Paris`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (response.data.success) {
      console.log('✅ Airport search successful');
      response.data.data.slice(0, 3).forEach((airport: any) => {
        console.log(`   ${airport.iataCode} - ${airport.name}, ${airport.address.cityName}`);
      });
    }
  } catch (error: any) {
    console.error('❌ Airport search failed:', error.response?.data || error.message);
  }
  
  // Test 4: Get location info
  console.log('\n\n4️⃣ Getting location info for JFK...');
  try {
    const response = await axios.get(
      `${API_BASE_URL}/flights/locations/JFK`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (response.data.success) {
      const location = response.data.data;
      console.log('✅ Location info retrieved');
      console.log(`   Airport: ${location.name}`);
      console.log(`   City: ${location.address.cityName}`);
      console.log(`   Country: ${location.address.countryName}`);
      console.log(`   Coordinates: ${location.geoCode.latitude}, ${location.geoCode.longitude}`);
    }
  } catch (error: any) {
    console.error('❌ Location info failed:', error.response?.data || error.message);
  }
}

async function main() {
  console.log('🔧 Testing Amadeus Flight Search Integration');
  console.log('==========================================\n');
  
  // Check server
  try {
    const response = await axios.get(`${API_BASE_URL}`);
    console.log('✅ Server is running');
    console.log('   Version:', response.data.data.version);
  } catch (error) {
    console.error('❌ Server is not running at', API_BASE_URL);
    console.error('   Please start the server with: npm run dev');
    process.exit(1);
  }
  
  // Authenticate and run tests
  if (await authenticate()) {
    await testFlightSearch();
    console.log('\n\n✅ All flight search tests completed!');
    console.log('\n📝 Summary:');
    console.log('   - Flight search with detailed parameters');
    console.log('   - Quick search for round trips');
    console.log('   - Airport search by keyword');
    console.log('   - Location information retrieval');
  }
}

main().catch(console.error);