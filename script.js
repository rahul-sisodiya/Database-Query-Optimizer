async function analyzeQuery() {
    const query = document.getElementById("query").value;

    if (!query) {
        alert("Please enter a query!");
        return;
    }
    const btn = document.querySelector("button");
    btn.disabled = true;
    btn.innerText = "Analyzing...";

    // Loading state
    document.getElementById("result").innerText = "⏳ Analyzing query...";

    try {
        const response = await fetch("http://localhost:3000/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ query: query })
        });

        const data = await response.json();

        // Display result
        document.getElementById("result").innerHTML = `
            <div class="result-box">
                <p><span class="label">Execution Time:</span> ${data.executionTime}</p>
                <p><span class="label">Indexes Suggested:</span> ${data.indexesSuggested}</p>
                <p><span class="label">Query Plan:</span> ${data.plan}</p>
            </div>
        `;

    } catch (error) {
        document.getElementById("result").innerText =
            "❌ Error connecting to server: " + error;
    }
    btn.disabled = false;
    btn.innerText = "Analyze Query";
}

