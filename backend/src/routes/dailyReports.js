import { Elysia } from "elysia";
import { supabase } from "../supabase.js";

export const dailyReportsRoutes =
new Elysia({
  prefix: "/reports"
})

.get("/daily",
async ({ query, set }) =>
{
  try
  {
    const {
      from,
      to
    } = query;

    let appointmentQuery =
      supabase
        .from("appointments")
        .select("*");

    if(from)
    {
      appointmentQuery =
        appointmentQuery.gte(
          "appointment_date",
          from
        );
    }

    if(to)
    {
      appointmentQuery =
        appointmentQuery.lte(
          "appointment_date",
          to
        );
    }

    const {
      data: appointments,
      error: appointmentError
    } = await appointmentQuery;

    if(appointmentError)
    {
      throw appointmentError;
    }

    const validAppointments =
      (appointments || []).filter(
        appointment =>
          appointment.status !==
          "rejected"
      );

    const {
      data: services,
      error: serviceError
    } = await supabase
      .from("appointment_services")
      .select("*");

    if(serviceError)
    {
      throw serviceError;
    }

    let expensesQuery =
  supabase
    .from("expenses")
    .select("*")
    .eq(
      "is_archived",
      false
    );

    if(from)
    {
      expensesQuery =
        expensesQuery.gte(
          "expense_date",
          from
        );
    }

    if(to)
    {
      expensesQuery =
        expensesQuery.lte(
          "expense_date",
          to
        );
    }

    const {
      data: expenses,
      error: expenseError
    } =
      await expensesQuery;

    if(expenseError)
    {
      throw expenseError;
    }

    const stats =
    {
      appointments:
        appointments.length,

      recalls:
        validAppointments.filter(
          appointment =>
            appointment.status ===
            "completed"
        ).length,

      patients:
        validAppointments.filter(
          appointment =>
            Number(
              appointment.amount_paid || 0
            ) > 0
        ).length
    };

    const patientAppointments =
      validAppointments.map(
        appointment => ({
          date:
            appointment.appointment_date,

          patientName:
            appointment.guest_name,

          clinic:
            appointment.branch_id,

          associate:
            appointment.dentist_id,

          reason:
            appointment.reason_for_visit,

          status:
            appointment.status
        })
      );

    const groupedProcedures = {};

    services.forEach(service =>
    {
      const appointment =
        validAppointments.find(
          appointment =>
            appointment.id ===
            service.appointment_id
        );

      if(!appointment)
      {
        return;
      }

      if(
        !groupedProcedures[
          service.appointment_id
        ]
      )
      {
        groupedProcedures[
          service.appointment_id
        ] =
        {
          date:
            appointment.appointment_date,

          patientName:
            appointment.guest_name,

          clinic:
            appointment.branch_id,

          procedures: [],

          totalBill: 0,

          totalPaid:
            appointment.amount_paid || 0
        };
      }

      groupedProcedures[
        service.appointment_id
      ].procedures.push(
        service.service_name
      );

      groupedProcedures[
        service.appointment_id
      ].totalBill +=
        Number(
          service.price || 0
        );
    });

    const patientProcedures =
      Object.values(
        groupedProcedures
      ).map(item => ({
        ...item,

        procedure:
          item.procedures.join(", ")
      }));

    const collections =
      validAppointments
        .filter(
          appointment =>
            Number(
              appointment.amount_paid || 0
            ) > 0
        )
        .map(
          appointment => ({
            date:
              appointment.appointment_date,

            patient:
              appointment.guest_name,

            clinic:
              appointment.branch_id,

            paymentType:
              appointment.payment_method,

            amount:
              appointment.amount_paid,

            remarks:
              appointment.payment_status
          })
        );

    const outstandingBalances =
      validAppointments
        .filter(
          appointment =>
            Number(
              appointment.remaining_balance || 0
            ) > 0
        )
        .map(
          appointment => ({
            date:
              appointment.appointment_date,

            patient:
              appointment.guest_name,

            totalBill:
              appointment.total_amount,

            amountPaid:
              appointment.amount_paid,

            balance:
              appointment.remaining_balance,

            status:
              appointment.payment_status
          })
        );

    const expenseRows =
  expenses.map(
    expense => ({
      date: expense.expense_date,
      clinic: expense.branch_id,
      description: expense.expense_name,
      type: expense.expense_type,
      category: expense.category,
      amount: expense.amount
    })
  );

    const billingAmount =
      validAppointments.reduce(
        (sum, appointment) =>
          sum +
          Number(
            appointment.total_amount || 0
          ),
        0
      );

    const collectionAmount =
      validAppointments.reduce(
        (sum, appointment) =>
          sum +
          Number(
            appointment.amount_paid || 0
          ),
        0
      );

    const expenseAmount =
      expenses
        .filter(
          expense =>
            expense.expense_type ===
            "expense"
        )
        .reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount || 0
            ),
          0
        );

    const billAmount =
      expenses
        .filter(
          expense =>
            expense.expense_type ===
            "bill"
        )
        .reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount || 0
            ),
          0
        );

    const income =
    {
      netIncome:
        collectionAmount -
        expenseAmount -
        billAmount,

      billingAmount,

      billingCount:
        validAppointments.length,

      expenseAmount,

      billAmount,

      expenseCount:
        expenses.filter(
          expense =>
            expense.expense_type ===
            "expense"
        ).length,

      billCount:
        expenses.filter(
          expense =>
            expense.expense_type ===
            "bill"
        ).length
    };

    return {
      success: true,
      stats,
      appointments: patientAppointments,
      procedures: patientProcedures,
      collections,
      outstandingBalances,
      expenses: expenseRows,
      income
    };
  }
  catch(error)
  {
    console.log(
      "DAILY REPORT ERROR:",
      error
    );

    set.status = 500;

    return {
      success: false,
      message:
        error.message
    };
  }
})

.get(
  "/monthly-summary",
  async ({ query, set }) =>
{
  try
  {
    const {
      month,
      year
    } = query;

    const startDate =
      `${year}-${String(month)
        .padStart(2,"0")}-01`;

    const endDate =
      new Date(
        Number(year),
        Number(month),
        0
      )
      .toISOString()
      .split("T")[0];

    const {
      data: appointments
    } =
      await supabase
        .from("appointments")
        .select("*")
        .gte(
          "appointment_date",
          startDate
        )
        .lte(
          "appointment_date",
          endDate
        );

    const validAppointments =
      (appointments || [])
      .filter(
        appointment =>
          appointment.status !==
          "rejected"
      );

    const {
  data: expenses
} =
  await supabase
    .from("expenses")
    .select("*")
    .eq(
      "is_archived",
      false
    )
    .gte(
      "expense_date",
      startDate
    )
    .lte(
      "expense_date",
      endDate
    );

    const billingAmount =
      validAppointments.reduce(
        (sum,a)=>
          sum +
          Number(
            a.total_amount || 0
          ),
        0
      );

    const collectionAmount =
      validAppointments.reduce(
        (sum,a)=>
          sum +
          Number(
            a.amount_paid || 0
          ),
        0
      );

    const expenseAmount =
      (expenses || [])
      .filter(
        expense =>
          expense.expense_type ===
          "expense"
      )
      .reduce(
        (sum,e)=>
          sum +
          Number(
            e.amount || 0
          ),
        0
      );

    const billAmount =
      (expenses || [])
      .filter(
        expense =>
          expense.expense_type ===
          "bill"
      )
      .reduce(
        (sum,e)=>
          sum +
          Number(
            e.amount || 0
          ),
        0
      );

    return {
  success: true,

  billingAmount,

  collectionAmount,

  expenseAmount,

  billAmount,

  expenseCount:
    (expenses || [])
      .filter(
        e =>
          e.expense_type ===
          "expense"
      ).length,

  billCount:
    (expenses || [])
      .filter(
        e =>
          e.expense_type ===
          "bill"
      ).length,

  operatingCost:
    expenseAmount +
    billAmount,

  netIncome:
    collectionAmount -
    expenseAmount -
    billAmount
};
  }
  catch(error)
  {
    set.status = 500;

    return {
      success: false,
      message:
        error.message
    };
  }
});
