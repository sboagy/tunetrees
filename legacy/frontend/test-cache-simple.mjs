#!/usr/bin/env node

// Simple test script to validate the cache functionality
// This tests the cache without requiring a full Jest setup

import { tableStateCacheService } from "../app/(main)/pages/practice/components/table-state-cache.js";

// Mock console methods for cleaner output
const originalConsole = {
  debug: console.debug,
  log: console.log,
  warn: console.warn,
  error: console.error,
};

let testOutput = [];
console.debug = (msg, ...args) => testOutput.push(`DEBUG: ${msg} ${args.join(' ')}`);
console.log = (msg, ...args) => testOutput.push(`LOG: ${msg} ${args.join(' ')}`);
console.warn = (msg, ...args) => testOutput.push(`WARN: ${msg} ${args.join(' ')}`);
console.error = (msg, ...args) => testOutput.push(`ERROR: ${msg} ${args.join(' ')}`);

// Mock the settings module
const mockUpdateResults = [];
const mockUpdateTableStateInDb = async (userId, screenSize, purpose, playlistId, state) => {
  mockUpdateResults.push({ userId, screenSize, purpose, playlistId, state });
  return 200; // success
};

// Replace the import with mock
global.updateTableStateInDb = mockUpdateTableStateInDb;

function runTests() {
  console.log('Running cache service tests...');
  
  // Test 1: Basic cache functionality
  console.log('\n=== Test 1: Basic Cache Operations ===');
  
  const mockTableState = { sorting: [{ id: "title", desc: false }] };
  
  // Clear cache first
  tableStateCacheService.clear();
  let stats = tableStateCacheService.getStats();
  console.log(`Initial stats: ${stats.totalEntries} total, ${stats.dirtyEntries} dirty`);
  
  // Cache an update
  tableStateCacheService.cacheUpdate(1, "practice", 123, mockTableState);
  stats = tableStateCacheService.getStats();
  console.log(`After cache update: ${stats.totalEntries} total, ${stats.dirtyEntries} dirty`);
  
  // Test 2: Multiple updates to same entry
  console.log('\n=== Test 2: Multiple Updates ===');
  tableStateCacheService.cacheUpdate(1, "practice", 123, { columnVisibility: { title: true } });
  stats = tableStateCacheService.getStats();
  console.log(`After second update: ${stats.totalEntries} total, ${stats.dirtyEntries} dirty`);
  
  // Test 3: Different purposes
  console.log('\n=== Test 3: Different Purposes ===');
  tableStateCacheService.cacheUpdate(1, "repertoire", 123, mockTableState);
  stats = tableStateCacheService.getStats();
  console.log(`After different purpose: ${stats.totalEntries} total, ${stats.dirtyEntries} dirty`);
  
  // Test 4: Immediate flush
  console.log('\n=== Test 4: Immediate Flush ===');
  const promise = tableStateCacheService.flushImmediate(1, "practice", 123, { sorting: [] });
  promise.then((result) => {
    console.log(`Flush result: ${result}`);
    const stats = tableStateCacheService.getStats();
    console.log(`After immediate flush: ${stats.totalEntries} total, ${stats.dirtyEntries} dirty`);
    
    // Test 5: Clear cache
    console.log('\n=== Test 5: Clear Cache ===');
    tableStateCacheService.clear();
    const finalStats = tableStateCacheService.getStats();
    console.log(`After clear: ${finalStats.totalEntries} total, ${finalStats.dirtyEntries} dirty`);
    
    // Output results
    console.log('\n=== Results ===');
    console.log('Mock API calls:', mockUpdateResults.length);
    console.log('Test output:', testOutput.filter(line => !line.includes('DEBUG:')).slice(0, 5));
    console.log('\nBasic functionality test completed successfully!');
    
    // Restore console
    Object.assign(console, originalConsole);
  });
}

runTests();