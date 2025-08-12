async function performSearch() {
  const query = document.getElementById("search").value;
  if (!query) return alert("Please enter a search term");

  const res = await fetch(`/.netlify/functions/serp?q=${encodeURIComponent(query)}`);
  const data = await res.json();

  document.getElementById("results").innerHTML = "";

  if (data.items) {
    data.items.forEach(item => {
      const div = document.createElement("div");
      div.innerHTML = `<h3><a href="${item.link}" target="_blank">${item.title}</a></h3>
                       <p>${item.snippet}</p>`;
      document.getElementById("results").appendChild(div);
    });
  } else {
    document.getElementById("results").innerHTML = "<p>No results found.</p>";
  }
}
