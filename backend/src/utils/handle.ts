import type { Actor } from 'wildebeest/backend/src/activitypub/actors'

const remoteHandleSymbol = Symbol()
const localHandleSymbol = Symbol()

export type RemoteHandle = {
	localPart: string
	domain: string
	[remoteHandleSymbol]: never
}

export type LocalHandle = {
	localPart: string
	domain: string | null
	[localHandleSymbol]: never
}

export type Handle = LocalHandle | RemoteHandle

export function isLocalHandle(handle: Handle): handle is LocalHandle {
	return handle.domain === null
}

// Parse a "handle" in the form: `[@] <local-part> '@' <domain>`
export function parseHandle(query: string): Handle {
	// In case the handle has been URL encoded
	query = decodeURIComponent(query)

	// Remove the leading @, if there's one.
	if (query.startsWith('@')) {
		query = query.substring(1)
	}

	const parts = query.split('@')
	const localPart = parts[0]

	if (!/^[\w\-.]+$/.test(localPart)) {
		throw new Error('invalid handle: localPart: ' + localPart)
	}

	if (parts.length > 1) {
		return { localPart, domain: parts[1] } as RemoteHandle
	} else {
		return { localPart, domain: null } as LocalHandle
	}
}

export function toRemoteHandle(handle: Handle, domain: string): RemoteHandle {
	if (isLocalHandle(handle)) {
		return { localPart: handle.localPart, domain } as RemoteHandle
	}
	return handle
}

// Naive way of transforming an Actor ObjectID into a handle like WebFinger uses
function urlToHandle({ pathname, host }: URL): RemoteHandle {
	const parts = pathname.split('/')
	if (parts.length === 0) {
		throw new Error('malformed URL')
	}
	const localPart = parts[parts.length - 1]
	return { localPart, domain: host } as RemoteHandle
}

export function actorToAcct(actor: Actor): string {
	if (actor.preferredUsername !== undefined) {
		return `${actor.preferredUsername}@${actor.id.host}`
	}
	return handleToAcct(urlToHandle(actor.id))
}

export function actorToHandle(actor: Actor): RemoteHandle {
	if (actor.preferredUsername !== undefined) {
		return { localPart: actor.preferredUsername, domain: actor.id.host } as RemoteHandle
	}
	return urlToHandle(actor.id)
}

export function handleToAcct(handle: RemoteHandle): string {
	return `${handle.localPart}@${handle.domain}`
}
