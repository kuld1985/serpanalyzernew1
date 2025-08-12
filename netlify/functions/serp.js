export async function handler(event, context) {
  try {
    const query = event.queryStringParameters.q;

    if (!query) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing search query" }),
      };
    }

    const CSE_ID = process.env.CSE_ID;
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

    const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${CSE_ID}&q=${encodeURIComponent(query)}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
