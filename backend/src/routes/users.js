import { Elysia } from "elysia";
import { supabase } from "../supabase.js";

const PAGE_SIZE = 5;

export const userRoutes = new Elysia({
  prefix: "/users"
})

/* =========================
   GET USERS
========================= */
.get("/", async ({ query, set }) => {

  const page =
    Number(query.page || 1);

  const from =
    (page - 1) * PAGE_SIZE;

  const to =
    from + PAGE_SIZE - 1;

  let dbQuery = supabase
  .from("users")
  .select("*", {
    count: "exact"
  });

if(query.archived !== undefined)
{
  const archived =
    query.archived === "true";

  dbQuery =
    dbQuery.eq(
      "is_archived",
      archived
    );
}

  // NAME FILTER
  if (query.name) {

    const searchName =
      query.name.trim();

    dbQuery = dbQuery.or(
      `
      first_name.ilike.%${searchName}%,
      middle_name.ilike.%${searchName}%,
      last_name.ilike.%${searchName}%
      `
    );
  }

  // ROLE FILTER
  if (query.role) {

    dbQuery = dbQuery.ilike(
      "role",
      `%${query.role}%`
    );
  }

  // YEAR FILTER
  if (query.year) {

    dbQuery = dbQuery
      .gte(
        "created_at",
        `${query.year}-01-01`
      )
      .lte(
        "created_at",
        `${query.year}-12-31`
      );
  }

  const {
    data,
    error,
    count
  } = await dbQuery.range(from, to);

  if (error) {

    set.status = 500;

    return {
      success: false,
      message: error.message,
    };
  }

  return {
    success: true,
    users: data || [],
    total: count ?? 0,
  };
})

/* =========================
   CREATE USER / PATIENT
========================= */
.post("/", async ({ body, set }) => {
  const { data, error } = await supabase
    .from("users")
    .insert([body])
    .select()
    .single();
    for(const user of data || [])
for(const user of data || [])
{
  const {
    data: visits
  } = await supabase
    .from("appointments")
    .select("appointment_date")
    .eq("patient_id", user.id)
    .eq("status", "completed")
    .order(
      "appointment_date",
      {
        ascending: false
      }
    )
    .limit(1);

  user.last_visit =
    visits?.[0]?.appointment_date ||
    null;
}

  if (error) {
    set.status = 500;

    return {
      success: false,
      message: error.message,
    };
  }

  return {
    success: true,
    user: data,
  };
})

/* =========================
   ARCHIVE USER
========================= */
.patch("/:id/archive",
async ({ params, set }) => {

  const { error } =
    await supabase
      .from("users")
      .update({
        is_archived: true
      })
      .eq("id", params.id);

  if (error) {

    set.status = 500;

    return {
      success: false,
      message: error.message,
    };
  }

  return {
    success: true,
  };
})

/* =========================
   RESTORE USER
========================= */
.patch("/:id/restore",
async ({ params, set }) => {

  const { error } =
    await supabase
      .from("users")
      .update({
        is_archived: false
      })
      .eq("id", params.id);

  if (error) {

    set.status = 500;

    return {
      success: false,
      message: error.message,
    };
  }

  return {
    success: true,
  };
})

/* =========================
   UPDATE USER
========================= */
.patch("/:id",
async ({ params, body, set }) => {

  const { error } =
    await supabase
      .from("users")
      .update(body)
      .eq("id", params.id);

  if (error) {

    set.status = 500;

    return {
      success: false,
      message: error.message,
    };
  }

  return {
    success: true,
  };
});
export async function getDentistsApi()
{
  const response =
    await getUsersApi({
      page: 1,
      archived: false,
      role: "dentist"
    });

  return {
    dentists:
      response.users || []
  };
}