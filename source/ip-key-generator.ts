import { isIPv6 } from 'node:net'
import { Address6 } from 'ip-address'

// Cache for IPv6 subnet calculations to avoid repeated parsing
const ipv6Cache = new Map<string, string>()
const MAX_CACHE_SIZE = 10000

/**
 * Returns the IP address itself for IPv4, or a CIDR-notation subnet for IPv6.
 *
 * If you write a custom keyGenerator that allows a fallback to IP address for
 * unauthenticated users, return ipKeyGenerator(req.ip) rather than just req.ip.
 *
 * For more information, {@see Options.ipv6Subnet}.
 *
 * @param ip {string} - The IP address to process, usually request.ip.
 * @param ipv6Subnet {number | false} - The subnet mask for IPv6 addresses.
 *
 * @returns {string} - The key generated from the IP address
 *
 * @public
 */
export function ipKeyGenerator(ip: string, ipv6Subnet: number | false = 56) {
	// Fast path: IPv4 or no subnet
	if (!ipv6Subnet || !isIPv6(ip)) {
		return ip
	}

	// For IPv6, check cache first
	const cacheKey = `${ip}/${ipv6Subnet}`
	const cached = ipv6Cache.get(cacheKey)
	if (cached !== undefined) {
		return cached
	}

	// Cache miss: calculate and store
	const result = `${new Address6(cacheKey).startAddress().correctForm()}/${ipv6Subnet}`

	// Prevent cache from growing unbounded
	if (ipv6Cache.size >= MAX_CACHE_SIZE) {
		// Remove oldest entry (first key in Map)
		const firstKey = ipv6Cache.keys().next().value
		if (firstKey !== undefined) {
			ipv6Cache.delete(firstKey)
		}
	}

	ipv6Cache.set(cacheKey, result)
	return result
}
