#!/usr/bin/env node

import { performance } from 'node:perf_hooks'
import { MemoryStore } from './dist/index.mjs'

// Benchmark configuration
const ITERATIONS = 100000
const UNIQUE_KEYS = 10000

console.log('Express Rate Limit - Performance Benchmarks')
console.log('='.repeat(60))
console.log(`Iterations: ${ITERATIONS.toLocaleString()}`)
console.log(`Unique keys: ${UNIQUE_KEYS.toLocaleString()}`)
console.log('')

// Helper function to run benchmarks
async function benchmark(name, fn) {
	// Warmup
	for (let i = 0; i < 1000; i++) {
		await fn()
	}

	// Actual benchmark
	const start = performance.now()
	for (let i = 0; i < ITERATIONS; i++) {
		await fn()
	}
	const end = performance.now()
	const duration = end - start
	const opsPerSec = (ITERATIONS / duration) * 1000

	console.log(`${name}:`)
	console.log(`  Time: ${duration.toFixed(2)}ms`)
	console.log(`  Ops/sec: ${opsPerSec.toLocaleString(undefined, { maximumFractionDigits: 0 })}`)
	console.log('')

	return { duration, opsPerSec }
}

// Test 1: Memory Store - Sequential increments (same key)
async function testSequentialIncrements() {
	const store = new MemoryStore()
	store.init({ windowMs: 60000 })
	const key = 'test-key'

	const results = await benchmark(
		'Memory Store - Sequential increments (same key)',
		() => store.increment(key)
	)

	store.shutdown()
	return results
}

// Test 2: Memory Store - Random key increments (hot path)
async function testRandomIncrements() {
	const store = new MemoryStore()
	store.init({ windowMs: 60000 })
	const keys = Array.from({ length: UNIQUE_KEYS }, (_, i) => `key-${i}`)
	let index = 0

	const results = await benchmark(
		'Memory Store - Random key increments (distributed load)',
		() => {
			const key = keys[index % UNIQUE_KEYS]
			index++
			return store.increment(key)
		}
	)

	store.shutdown()
	return results
}

// Test 3: Memory Store - Get operations
async function testGetOperations() {
	const store = new MemoryStore()
	store.init({ windowMs: 60000 })
	const keys = Array.from({ length: UNIQUE_KEYS }, (_, i) => `key-${i}`)

	// Pre-populate store
	for (const key of keys) {
		await store.increment(key)
	}

	let index = 0
	const results = await benchmark(
		'Memory Store - Get operations',
		() => {
			const key = keys[index % UNIQUE_KEYS]
			index++
			return store.get(key)
		}
	)

	store.shutdown()
	return results
}

// Test 4: IPv6 Key Generation (with caching)
import { ipKeyGenerator } from './dist/index.mjs'

async function testIpv6KeyGeneration() {
	const ipv6Addresses = Array.from(
		{ length: 1000 },
		(_, i) => `2001:0db8:85a3:${i.toString(16).padStart(4, '0')}:0000:8a2e:0370:7334`
	)
	let index = 0

	const results = await benchmark(
		'IPv6 Key Generation (with cache)',
		() => {
			const ip = ipv6Addresses[index % ipv6Addresses.length]
			index++
			return ipKeyGenerator(ip, 56)
		}
	)

	return results
}

// Test 5: IPv4 Key Generation
async function testIpv4KeyGeneration() {
	const ipv4Addresses = Array.from(
		{ length: 1000 },
		(_, i) => `192.168.${Math.floor(i / 256)}.${i % 256}`
	)
	let index = 0

	const results = await benchmark(
		'IPv4 Key Generation (fast path)',
		() => {
			const ip = ipv4Addresses[index % ipv4Addresses.length]
			index++
			return ipKeyGenerator(ip, false)
		}
	)

	return results
}

// Run all benchmarks
async function runAll() {
	const results = {}

	results.sequentialIncrements = await testSequentialIncrements()
	results.randomIncrements = await testRandomIncrements()
	results.getOperations = await testGetOperations()
	results.ipv6KeyGeneration = await testIpv6KeyGeneration()
	results.ipv4KeyGeneration = await testIpv4KeyGeneration()

	console.log('='.repeat(60))
	console.log('Summary of Optimization Benefits:')
	console.log('')
	console.log('1. Fast path optimization in increment():')
	console.log('   - Avoids getClient() call for existing keys in current map')
	console.log(`   - Sequential ops/sec: ${results.sequentialIncrements.opsPerSec.toLocaleString(undefined, { maximumFractionDigits: 0 })}`)
	console.log('')
	console.log('2. Cached timestamp calculations:')
	console.log('   - Single Date.now() call per increment')
	console.log('   - Reduced overhead in hot path')
	console.log('')
	console.log('3. IPv6 key generation caching:')
	console.log(`   - IPv6 ops/sec: ${results.ipv6KeyGeneration.opsPerSec.toLocaleString(undefined, { maximumFractionDigits: 0 })}`)
	console.log('   - Avoids expensive Address6 parsing for repeated IPs')
	console.log('')
	console.log('4. IPv4 fast path:')
	console.log(`   - IPv4 ops/sec: ${results.ipv4KeyGeneration.opsPerSec.toLocaleString(undefined, { maximumFractionDigits: 0 })}`)
	console.log('   - Direct return without processing')
	console.log('')
	console.log('5. Optimized identifier string generation:')
	console.log('   - Pre-calculated constants (60000, 3600000, 86400000)')
	console.log('   - Reduced repeated division operations')
	console.log('')

	return results
}

runAll().catch(console.error)
