import { createPerson, getPersonByEmail, type Person } from 'wildebeest/backend/src/activitypub/actors'
import { replies, statuses } from 'wildebeest/frontend/src/dummyData'
import type { Account, MastodonStatus } from 'wildebeest/frontend/src/types'
import { createPublicNote, Note } from 'wildebeest/backend/src/activitypub/objects/note'
import { addObjectInOutbox } from 'wildebeest/backend/src/activitypub/actors/outbox'
import { createReblog } from 'wildebeest/backend/src/mastodon/reblog'
import { insertReply } from 'wildebeest/backend/src/mastodon/reply'

/**
 * Run helper commands to initialize the database with actors, statuses, etc.
 */
export async function init(domain: string, db: D1Database) {
	const loadedStatuses: { status: MastodonStatus; note: Note }[] = []
	for (const status of statuses) {
		const actor = await getOrCreatePerson(domain, db, status.account)
		const note = await createStatus(domain, db, actor, status.content)
		loadedStatuses.push({ status, note })
	}

	const { reblogger, noteToReblog } = await pickReblogDetails(loadedStatuses, domain, db)
	await createReblog(db, reblogger, noteToReblog)

	for (const reply of replies) {
		await createReply(domain, db, reply, loadedStatuses)
	}
}

/**
 * Create a status object in the given actor's outbox.
 */
async function createStatus(domain: string, db: D1Database, actor: Person, content: string) {
	const note = await createPublicNote(domain, db, content, actor)
	await addObjectInOutbox(db, actor, note)
	return note
}

/**
 * Creates a reply for a note (representing a status)
 */
async function createReply(
	domain: string,
	db: D1Database,
	reply: MastodonStatus,
	loadedStatuses: { status: MastodonStatus; note: Note }[]
) {
	if (!reply.in_reply_to_id) {
		console.warn(`Ignoring reply with id ${reply.id} since it doesn't have a in_reply_to_id field`)
		return
	}

	const originalStatus = loadedStatuses.find(({ status: { id } }) => id === reply.in_reply_to_id)
	if (!originalStatus) {
		console.warn(`Ignoring reply since no status matching the in_reply_to_id ${reply.id} has been found`)
		return
	}

	const inReplyTo = originalStatus.note.mastodonId
	const actor = await getOrCreatePerson(domain, db, reply.account)
	const replyNote = await createPublicNote(domain, db, reply.content, actor, [], { inReplyTo })
	await insertReply(db, actor, replyNote, originalStatus.note)
}

async function getOrCreatePerson(
	domain: string,
	db: D1Database,
	{ username, avatar, display_name }: Account
): Promise<Person> {
	const person = await getPersonByEmail(db, username)
	if (person) return person
	const newPerson = await createPerson(domain, db, 'test-kek', username, {
		icon: { url: avatar },
		name: display_name,
	})
	if (!newPerson) {
		throw new Error('Could not create Actor ' + username)
	}
	return newPerson
}

/**
 * Picks the details to use to reblog an arbitrary note/status.
 *
 * Both the note/status and the reblogger are picked arbitrarily
 * form a list of available notes/states (respectively from the first
 * and second entries).
 */
async function pickReblogDetails(
	loadedStatuses: { status: MastodonStatus; note: Note }[],
	domain: string,
	db: D1Database
) {
	const rebloggerAccount = loadedStatuses[1].status.account
	const reblogger = await getOrCreatePerson(domain, db, rebloggerAccount)
	const noteToReblog = loadedStatuses[2].note
	return { reblogger, noteToReblog }
}
