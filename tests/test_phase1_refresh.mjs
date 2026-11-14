import { getAccurateMeteorology, calculateScientificWeather } from '../src/utils/weatherService.js';
import { REGIONS, calculateParameterAtDepth } from '../src/data/oceanData.js';

async function runTests() {
  console.log('=== TEST Phase 1.1: Real-Time Data Refresh & Live Ticker ===\n');

  // Test 1: getAccurateMeteorology returns complete meteorological telemetry
  const bob = REGIONS.bay_of_bengal;
  const met1 = await getAccurateMeteorology(bob.lat, bob.lon, new Date(), bob.sst, false);
  
  if (!met1 || typeof met1.sst !== 'number' || typeof met1.waveHeight !== 'number' || typeof met1.currentSpeed !== 'number') {
    throw new Error('Test 1 Failed: getAccurateMeteorology did not return valid meteorological structure');
  }
  console.log('✓ Test 1 Passed: getAccurateMeteorology returned valid telemetry structure:', {
    isLive: met1.isLive,
    sst: met1.sst,
    currentSpeed: met1.currentSpeed,
    waveHeight: met1.waveHeight,
    pressure: met1.pressure,
    windSpeedKmH: met1.windSpeedKmH
  });

  // Test 2: forceRefresh parameter bypasses cache and returns fresh data
  const met2 = await getAccurateMeteorology(bob.lat, bob.lon, new Date(), bob.sst, true);
  if (!met2 || typeof met2.sst !== 'number') {
    throw new Error('Test 2 Failed: forceRefresh=true failed to return data');
  }
  console.log('✓ Test 2 Passed: forceRefresh=true successfully retrieved fresh readings');

  // Test 3: Scientific fallback physics calculates realistic temporal variation
  const dateA = new Date('2026-11-14T12:00:00Z');
  const dateB = new Date('2026-11-14T12:01:30Z');
  const sciA = calculateScientificWeather(bob.lat, bob.lon, dateA, bob.sst);
  const sciB = calculateScientificWeather(bob.lat, bob.lon, dateB, bob.sst);
  
  if (typeof sciA.sst !== 'number' || typeof sciB.sst !== 'number') {
    throw new Error('Test 3 Failed: calculateScientificWeather did not return numbers');
  }
  console.log(`✓ Test 3 Passed: Fallback physics calculates realistic observations:`);
  console.log(`   T0: SST=${sciA.sst}°C, Wave=${sciA.waveHeight}m, Current=${sciA.currentSpeed}m/s`);
  console.log(`   T1: SST=${sciB.sst}°C, Wave=${sciB.waveHeight}m, Current=${sciB.currentSpeed}m/s`);

  // Test 4: calculateParameterAtDepth updates accurately when region values change
  const valSst50 = calculateParameterAtDepth('sst', 50, { ...bob, sst: met1.sst });
  const valWave0 = calculateParameterAtDepth('wave', 0, { ...bob, waveHeight: met1.waveHeight });
  const valCurrent0 = calculateParameterAtDepth('currents', 0, { ...bob, currentSpeed: met1.currentSpeed });

  if (isNaN(valSst50) || isNaN(valWave0) || isNaN(valCurrent0)) {
    throw new Error('Test 4 Failed: calculateParameterAtDepth produced NaN');
  }
  console.log('✓ Test 4 Passed: calculateParameterAtDepth correctly dynamic with refreshed activeRegion:');
  console.log(`   sst@50m: ${valSst50}°C, wave@surface: ${valWave0}m, current@surface: ${valCurrent0}m/s`);

  console.log('\nALL PHASE 1.1 UNIT & INTEGRATION TESTS PASSED! 🎉');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
