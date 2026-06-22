// api/patients.js

import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL;

export async function getPatientsApi()
{
  console.log(
    "PATIENT API FILE CALLED"
  );

  const response =
    await axios.get(
      `${API_URL}/patients`
    );
    console.log(
  "API PATIENTS:",
  response.data.patients.length
);

  return response.data;
}

export const getPatientDetailsApi =
async (id) => {

  const response =
    await axios.get(
      `${API_URL}/patients/${id}`
    );

  return response.data;
};

export const addPatientRecordApi =
async (patientId, data) => {

  const response =
    await axios.post(
      `${API_URL}/patients/${patientId}/records`,
      data
    );

  return response.data;
};

export const getPatientRecordsApi =
async (patientId) =>
{
  const response =
    await axios.get(
      `${API_URL}/patients/${patientId}/records`
    );

  return response.data;
};