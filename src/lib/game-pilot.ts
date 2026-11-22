/**
 * The game « augmentation » pilot (approved by Xavier on 19 Nov 2026) —
 * phase 1: 100 treated game fiches get the « Fiche pratique » block, a visible
 * « Pourquoi cet âge ? », every parent point and younger alternatives; 100
 * matched control fiches get NOTHING, so the two groups can be compared in
 * Search Console.
 *
 * Pure and dependency-free: imported by the fiche (server) and the
 * game-facts writer. Ids are media_items ids.
 *
 * ── Selection (run read-only on 20 Nov 2026, 1,942 eligible games) ──────────
 * Pool: released, enriched games with an age, an analysis and a game-database
 * id. Popularity proxy: the stored audience vote count (quintiles). Strata:
 * age band (0-6 / 7-9 / 10-12 / 13-15 / 16+) × popularity quintile × « Totem
 * above PEGI » flag.
 *
 * TREATED — weighted random draw (Efraimidis–Spirakis, fixed md5 seed), weight
 *   1 + 6 × (Totem age > PEGI age) + 2 × (quick-answer wording shared by ≥ 50
 *   games; the wording is fully determined by the age + the axis flags in `sig`)
 *   capped at half of each stratum so every treated game has a twin.
 * CONTROL — in each stratum, as many non-treated games as treated ones, in a
 *   fixed md5 order: exact match on age band, popularity quintile and gap flag.
 *
 * Result: treated 100 (31 Totem > PEGI, 60 in a ≥ 50 wording group, mean age
 * 11.6, median votes 45.5); control 100 (31, 42, 11.7, 43). The gap and
 * popularity are balanced by construction; the shared-wording weight is NOT
 * matched (a control can't be « more generic » on purpose), so read the result
 * per stratum if it matters.
 *
 * Re-running the query on a later catalogue gives a different draw: these
 * frozen lists are the pilot, not the query.
 *
 *   with base as (
 *     select m.id, m.title, m.expert_age_rec age, coalesce(m.tmdb_vote_count, 0) votes,
 *       case when m.official_rating like 'PEGI_%' then substring(m.official_rating from 6)::int end pegi,
 *       concat_ws('|', m.expert_age_rec,
 *         (cm.violence >= 3)::int, (cm.sex_nudity >= 3)::int, (cm.language >= 3)::int,
 *         (cm.substance_use >= 3)::int, (cm.consumerism >= 3)::int,
 *         (cm.positive_messages >= 4)::int, (cm.role_models >= 4)::int) sig
 *     from media_items m join content_metrics cm on cm.media_id = m.id
 *     where m.type = 'GAME' and m.is_enriched and m.expert_age_rec is not null
 *       and m.igdb_id is not null and (m.release_date is null or m.release_date <= now())
 *   ),
 *   g as (
 *     select b.*, count(*) over (partition by sig) sig_n,
 *       case when age <= 6 then 'a0-6' when age <= 9 then 'a7-9' when age <= 12 then 'a10-12'
 *            when age <= 15 then 'a13-15' else 'a16+' end band,
 *       ntile(5) over (order by votes, id) pop_q,
 *       (pegi is not null and age > pegi) gap
 *     from base b
 *   ),
 *   w as (
 *     select g.*,
 *       -ln(greatest(('x' || substr(md5('totem-pilot-2026-11-19:' || id), 1, 8))::bit(32)::bigint::float8 / 4294967296.0, 1e-9))
 *         / (1 + 6 * gap::int + 2 * (sig_n >= 50)::int) k
 *     from g
 *   ),
 *   s as (
 *     select w.*,
 *       row_number() over (partition by band, pop_q, gap order by k) rn_s,
 *       count(*) over (partition by band, pop_q, gap) pool_s
 *     from w
 *   ),
 *   treated as (select * from s where rn_s <= pool_s / 2 order by k limit 100),
 *   strata as (select band, pop_q, gap, count(*) n from treated group by 1, 2, 3),
 *   control as (
 *     select c.* from (
 *       select s.*, row_number() over (partition by band, pop_q, gap order by md5('totem-pilot-ctl:' || id)) rn_c
 *       from s where id not in (select id from treated)
 *     ) c join strata using (band, pop_q, gap) where c.rn_c <= strata.n
 *   )
 *   select 'T' grp, id, title, age, pegi, votes, sig_n, gap, band, pop_q from treated
 *   union all
 *   select 'C', id, title, age, pegi, votes, sig_n, gap, band, pop_q from control
 *   order by grp desc, title
 */

// ── Pilot length (Xavier, 21 Nov 2026) ─────────────────────────────────────
// SIX WEEKS before comparing treated vs control in Search Console. Day 0 = the
// day the game-facts backfill runs on the treated games: Day 0 = 22 Nov 2026
// (100/100 written, 11:37 UTC) → comparison due 3 Jan 2027. Don't widen,
// re-draw or edit these lists before the comparison: either would spoil it.
export const GAME_PILOT_TREATED_IDS: readonly string[] = [
  "01f7bc58-97ea-432e-bdc6-614f7ae37393",
  "05c10fcd-9b53-4255-b85a-2ab1be4cc923",
  "073bacbb-2472-46db-a106-5b324f8f480b",
  "095106fa-bc48-4bd9-9461-adc1ae2a088e",
  "0cb639a3-c908-4da5-9c0f-e19e02a824f9",
  "0cb8ed0a-a3de-4c16-a7e0-2b03d3d4d68c",
  "0cd09c3d-22c4-474e-91c5-41ffba2b543c",
  "0d110b9f-e262-4b11-9bc4-f9c7d32cff2b",
  "0f88a343-a23c-45dd-abc0-ca19c6494716",
  "1372399c-924c-44c3-8c68-175a0b616aec",
  "185a7c51-5ff0-4ea7-ba0d-6e0c2ff5626e",
  "1a199bb4-9912-4f84-9939-6ab96979c5e3",
  "1b2e87ff-db94-456e-be9b-cdc5c5ef26d7",
  "1f73e54c-b696-439f-b2f4-9ad8f1337403",
  "2173924c-9383-43b9-a8c6-0732a9b93a72",
  "2a673b1b-d445-46cc-b17a-2bc527e7afac",
  "31837442-8c2d-422d-90e8-452705f26641",
  "3281c949-664a-4c8c-963d-50631b9484fc",
  "3449db85-d4ed-4bb8-8a82-9c0954bfac5d",
  "37746906-b178-40db-88d7-75a84e432b1b",
  "37817e71-816a-47a2-98d1-5f9019ea5519",
  "38e53b4f-c575-41a6-92d2-5d95a38ae3c9",
  "3e7b3301-b093-455c-94d2-df1d39f86624",
  "3f02933d-3884-4461-9cc2-c0597ed4dbac",
  "41f198c5-8bed-448b-8e23-90a6cf410cd1",
  "44184b3b-4839-4470-918f-231b7d4682da",
  "46e4f32c-fca8-4912-9eb9-70baa84153ff",
  "47d96c5e-7b38-43e6-9674-4a9ddde747de",
  "48b39277-352e-48bf-a295-d162ac4734b6",
  "4b12357e-9174-45db-9e8e-e6519350e898",
  "4d83f465-7ba3-4b12-8b8f-c2d4f0ba4613",
  "4e058f4f-edfe-4c29-a0fd-1d1c532b159b",
  "56805f27-1197-47b5-96ae-f692cc48c6c7",
  "58762b3a-d880-4712-b6dc-b13e63fe2dbc",
  "59561913-077b-4f7b-9ebf-507747ad0ca9",
  "5a078c0c-8119-487e-8519-5c6779566a70",
  "5ecf6aa1-cb70-40d9-a8af-cf5f25db0f62",
  "5f26afaa-09fd-4047-874e-ea05338ad5ce",
  "5fa38922-fef6-4af0-8335-ec8713cab512",
  "60d912a0-e931-445a-a0ec-6c9d7b6173a7",
  "64325c8b-2b70-4ef3-ae96-181e70cab41a",
  "6dd6bdeb-8955-48e9-a8ba-c407465993be",
  "72b3f7d2-7c2c-402d-ad9e-9176c059c7ce",
  "757f5294-1e8e-4673-af92-834c236d3450",
  "7cd40efa-bb79-401d-97a4-355f561d58d5",
  "7d7e2e4b-fecb-4848-9108-fa412ef6d333",
  "7f161cd3-d4a1-4c74-9911-4a7384827b0c",
  "7fbb99fa-8754-4fd4-84b0-683a95c2acec",
  "8088f990-715a-498d-85ea-3679c7b08445",
  "82ed8759-c515-40ca-baf7-2dc35a664ee6",
  "82f0641d-6e53-46a1-9d74-fa6c9ad57c8d",
  "831bc703-c518-43e1-87b4-afe4f2e81248",
  "8447bd2a-3131-4d27-b3b0-4c49e172ea04",
  "8b51cbd8-1787-4840-992b-37e9f5dd133d",
  "8beaaa88-5b3e-401e-8ed4-4e8a714c35f6",
  "8c5fd1a7-079f-4ba2-9fbc-76537fafa489",
  "900166bf-2ec4-47dd-a441-9a89d40e2579",
  "944a2e61-bb57-4450-8d5c-2df43ce16c72",
  "9519ea24-6474-49b9-9e57-d7fa39d9487c",
  "961dbff8-df43-4582-ae48-431e29459b33",
  "98fddf91-861f-4c7c-be83-4c41938e8c9e",
  "9af3f0d5-39ba-4ade-ad62-96d4fe8a1c89",
  "9c1773bf-4c6a-477f-a168-1898e942f192",
  "9ec52098-2450-4971-a2e7-acd78e244c4f",
  "acbd76e1-be8d-4fad-a10b-175b1f9bd74f",
  "adb36a76-08fe-4572-b0cb-c144caac934c",
  "ae771e5c-f6c1-4573-9f23-f29d1df8e24e",
  "aebcf37d-5334-4249-912c-db0f664f34a8",
  "b3c89c0a-216a-4c48-b848-b83b5d71039a",
  "b72c265e-b4e9-4dbe-9c52-e4324dfafc8e",
  "b7bab933-8b41-47d5-9f9d-da62c3b7e260",
  "b91909e3-aa07-4590-a0cd-35544c3e5e54",
  "b9e8fd46-12f8-455f-b97e-e3a9db2f7b15",
  "bab4d2b0-ab3e-4b51-ba0f-c24a3bf8bc45",
  "bc898da3-4cdd-4202-86d3-54f40fe884db",
  "bdd9a779-a7cf-4d2c-a7c0-fa7ae2ea3615",
  "c2f2f94d-5790-4a49-9cc2-db2424f7b011",
  "c49a7989-7d37-42d4-8e61-68ff34b68097",
  "c618bce4-e463-452e-821d-8fc3703bec73",
  "c7f35bcf-d644-4d42-acb2-20ce0e765fd5",
  "c81e9ae6-f4f6-41f3-a610-1a61e3ae28a7",
  "cb627852-a350-4dad-bd21-42ed24688d76",
  "ccd02b39-dd60-45ba-a955-0f2993e4b15b",
  "ceb920f6-d550-4385-8e8f-ae48236e7994",
  "da925fd8-7e52-4de6-86a0-a659204a1e9d",
  "dc64fc22-a298-468a-a81b-df373105de9e",
  "e1171fc5-632d-4be2-acf3-1daad3cb160d",
  "e73ef442-21d3-4c31-9d12-25d09142f66a",
  "e9f27f83-df01-4312-bfcf-ffa651f0a345",
  "eb4b3bf7-9070-4208-9d55-bcae8ef92b13",
  "ecd4a600-5114-49b8-ac40-a86b84838097",
  "ed9927cd-6b3d-440e-9099-92eef1755c56",
  "efb11b52-d377-472f-9bfb-47d4f498544e",
  "f19385bb-6229-4dfc-86bd-5f8229892a32",
  "f9aba79d-de4b-44ca-98b8-f780e950604a",
  "fa64823a-c712-4d68-adc5-89810b107496",
  "fd8e2083-184e-4989-848f-64a22f762c58",
  "fe4a9554-c428-4549-8b21-1fdbe075dd74",
  "fea40e12-7e91-48d5-8496-18fb841e2397",
  "ffed6592-6a3e-45d4-8221-40b7e1cebb61",
]

export const GAME_PILOT_CONTROL_IDS: readonly string[] = [
  "020a400c-6c5e-4366-8714-fea65619c308",
  "02ce9461-4d95-450a-9da2-b3e472883817",
  "03748f86-e2ba-46f8-b4ea-4891897b1e7e",
  "097920b3-84e2-44b6-8294-4bf7d4729f75",
  "0a0206aa-c9f1-47de-ab5d-b57520f3cb4f",
  "0afe5aec-0ec0-474e-b683-c66f22734324",
  "0bbdd2b2-f241-41b5-8959-5b8c349a55fc",
  "11c3781b-779f-4b2c-bc8a-9dc3555dafba",
  "18935b82-bc84-478b-9db1-a20270ec7421",
  "1d9a400f-54c7-44e2-a154-5431142e5c3c",
  "1f4db076-602e-41fd-bbd2-f476cf02980e",
  "20903891-c0bf-4398-8b11-cc714d574308",
  "2612d338-ecdf-4d20-9a97-54d1d042568b",
  "28d6864c-2647-4331-8d05-9f2532de1a2d",
  "2c9edc93-476d-4a90-ba06-dff481edb2de",
  "3032ddec-d742-4c08-827d-62324ee92426",
  "31d33a9d-3014-46f7-bd09-d86b15eb6b67",
  "357a8e67-08ce-4f40-b09b-7691310adf0e",
  "37a90cb3-4e5b-4569-b7c2-fee82c19538f",
  "3cada6e6-305d-4e1b-a19c-c806a2ddef57",
  "3e7d7fbe-ed29-44b0-8763-07da85e9f95e",
  "41f41bd1-cdbe-4207-827d-866f6aa55087",
  "445103f7-e8d6-410b-8373-7b100b6526f8",
  "44a7d8f4-72b5-47ee-acb0-7a3b6dd22f86",
  "45990d98-83a3-4bfb-91f8-b5d6ccce7caf",
  "4afd689b-5aa1-4bba-a8da-fbe912fcec7d",
  "4e57153f-d457-4b72-b64a-2d5ae441bc5f",
  "514e5353-0681-4b6c-ac8a-8e39b6028164",
  "52e4b498-544b-4346-81c8-ebd44e738bb5",
  "5e94deea-29ed-4e73-ada4-7bf2f7440421",
  "5f2cd5fe-5596-4594-902d-81b94bb164ad",
  "61203b91-0c79-4a02-bedd-8f9265eba812",
  "623c5753-8ed1-42c1-ac5b-1eec1f08738e",
  "62b3c03a-c1cc-4012-9de3-bcb4e14c9b7c",
  "62e8406f-d9bf-4710-b163-a092e321b1cb",
  "669f7d4e-c67f-43e0-a32c-ba032d87b03f",
  "67a91308-5433-477d-a9fe-852d9426ec95",
  "6ac1100e-4a16-413f-a932-ecc83f02d270",
  "6d6b2be6-4d1a-485f-bc11-a11c43691a82",
  "6dd3c3b5-6a01-4486-9ff1-509eb9e78bfc",
  "6ebcf875-148b-4f52-98d7-62ff5c6bc37c",
  "6fcce4e4-0314-4e8c-b072-e3529b1c5312",
  "703b5ccb-3edf-4235-a547-963b237edd25",
  "7293c2e9-c0ea-4dc7-b34c-a066e8926493",
  "72a7c38b-17cc-4a9b-940e-4d4410c1a69b",
  "747e6c66-90bf-4ace-ba40-06b990ec4f76",
  "7507f151-b6cc-428b-81b8-fd247abcaa40",
  "88eccbd3-f892-462d-92a6-de45dfc2baa1",
  "8b7eb638-b306-4b38-8add-a4719e1a2c6f",
  "8dcb6052-a3c6-4285-b135-2a6a540ee064",
  "8f56d876-9b0c-440e-bc5d-b7d9f4902cc6",
  "8f8a1914-9548-41ec-9733-0b25c78b4b9b",
  "90aa14a5-7652-4c5a-8aaa-bf9a62fd7581",
  "9656ea95-01aa-43ad-99b4-d571784307b5",
  "9874d048-6965-465c-a56f-e248afbdbf88",
  "9b1668c7-47a4-4f4d-a6b2-43ee07fe2cbc",
  "9dd84028-a6bc-4693-bd77-2ef8dd01cfac",
  "9f1b4fff-2060-4110-9ab6-9ec7e639df8b",
  "a015f2c7-2580-40a3-a79c-8c63e11edf63",
  "a0cee721-724d-4e49-81db-e785a04827bf",
  "a7d8af23-bc51-46bd-86f0-286bb25bc949",
  "aa11531a-71d1-4b14-a35f-cd28ff4555fb",
  "ac052e0b-b8fc-4bbb-a547-987860989cab",
  "ad41bce9-af53-4751-a504-7793cb0556f1",
  "b2b5526d-6f63-41a7-9dda-f91049d98096",
  "b67dad52-9258-4ee6-8da1-2f3e42adf5ae",
  "b7c8865b-099f-447a-b5a2-b0ee790abe42",
  "bf507a80-d249-46ec-beb2-0a82aa9bc847",
  "c1e13e78-cc6e-4938-a3bc-7f4fb2045ed5",
  "c2232a74-773d-4037-b838-c35191da91b9",
  "c2dea4b7-b1f3-4c43-a8ef-b6b111167d56",
  "c5a79dbc-2fb6-4690-97de-b85eadf445fc",
  "c75d4847-aaf8-44e8-af39-22f3817d2534",
  "c895fdb5-0e23-4366-b36e-3ba26ae78cc4",
  "cbc8bce2-c8f3-49b0-81d1-ff2c8bffae8f",
  "cee4e1d6-057e-4d6b-b237-cd4058a8ccae",
  "d13a173b-44a7-449a-b21b-0733d3e165c8",
  "d44f45cb-8bb6-44e3-b48f-a3cb16375c04",
  "d6d08fdc-929e-47d5-8007-3115d8ffd33e",
  "d95f302b-b211-456d-a8fd-2be9f4e1e1d2",
  "d996ea8a-0c4a-4819-b3bb-785f47bea755",
  "da430801-eca7-4846-b4a2-d0c86b8f22e9",
  "daeb84a6-ec3e-4fc0-bfd8-894b741eb167",
  "db602fb1-7b0e-45e8-98a1-c66f5954a887",
  "db714898-93c9-46a5-8e08-3f6f68918cf7",
  "dd047201-7928-4286-b49e-4e326a8b2744",
  "de227829-536f-4511-a661-6303e52ec26a",
  "e16e9f1d-b821-450a-a463-45495e5a801b",
  "e877f44b-685f-4130-98d0-39d75307644f",
  "e9c7832c-886f-4de9-900d-7330789edbdd",
  "ea1443e4-4974-48e9-a8ba-d421a979f345",
  "f362cc01-e682-4739-9554-4fd606cc023e",
  "f4ba852b-188d-4362-ac0e-f440e12fe63b",
  "f89493a7-8c59-4246-8e42-5a03d5b5ba8f",
  "f97df83c-e53e-41f5-b426-c2af121c88e6",
  "f9a9c5b9-c6e8-445b-b1fb-838c478b5b6a",
  "fce5e926-5178-472d-98c9-9c0daf314e26",
  "fe92c395-97a5-48cc-bdf6-516e2dde1671",
  "ff542104-a30e-4247-b591-9a8c5b51a4e0",
  "fff9249c-da0b-4cd3-917c-9c941c80eddf",
]

const TREATED = new Set(GAME_PILOT_TREATED_IDS)
const CONTROL = new Set(GAME_PILOT_CONTROL_IDS)

/** True for a TREATED pilot fiche (the only ones that change). */
export function isGamePilot(id: string | null | undefined): boolean {
  return typeof id === "string" && TREATED.has(id)
}

/** True for a CONTROL fiche — kept exactly as it is, for comparison. */
export function isGamePilotControl(id: string | null | undefined): boolean {
  return typeof id === "string" && CONTROL.has(id)
}
