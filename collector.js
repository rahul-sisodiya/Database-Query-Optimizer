const { MongoClient } = require("mongodb");

const url = "mongodb://localhost:27017";

async function collectQueries() {
  const client = new MongoClient(url);

  try {
    await client.connect();

    const db = client.db("weather"); // your database name
    const profile = db.collection("system.profile");

    const queries = await profile
      .find({
        op: "query",
        ns: { $not: /system.profile/ }
      })
      .limit(3)
      .toArray();

    console.log("Collected Queries:\n");

    for (const q of queries) {

      const inefficient =
        q.docsExamined > 100 && q.planSummary === "COLLSCAN";

      console.log("Collection:", q.ns);
      console.log("Filter:", q.command.filter);
      console.log("Docs Examined:", q.docsExamined);
      console.log("Plan:", q.planSummary);

      if (!inefficient) {
        console.log("Query looks efficient — skipping");
        console.log("-------------------------");
        continue;
      }

      console.log("Inefficient Query Detected");

      const fields = extractFields(q.command.filter);
      const index = recommendIndex(fields);

      console.log("Recommended Index:", index);

      const collectionName = q.ns.split(".")[1];
      const collection = db.collection(collectionName);

      // Selectivity Check
      const totalDocs = await collection.countDocuments();
      const returnedDocs = q.nreturned || 0;
      const selectivity = returnedDocs / totalDocs;

      console.log("Selectivity:", selectivity.toFixed(2));

      if (selectivity > 0.7) {
        console.log("Query returns most documents — index may not help");
        console.log("-------------------------");
        continue;
      }

      // Check if index exists
      const exists = await indexExists(collection, index);

      if (exists) {
        console.log("Index already exists — skipping creation");
      } else {
        console.log("Creating Index...");
        await collection.createIndex(index);
        console.log("Index Created Successfully");
      }

      // Benchmark
      const beforeTime = await measurePerformance(
        collection,
        q.command.filter
      );

      const afterTime = await measurePerformance(
        collection,
        q.command.filter
      );

      console.log("Before Avg Time:", beforeTime.toFixed(2), "ms");
      console.log("After Avg Time:", afterTime.toFixed(2), "ms");

      let improvement = 0;

      if (beforeTime > 0) {
        improvement =
          ((beforeTime - afterTime) / beforeTime) * 100;
      }

      console.log(
        "Performance Improvement:",
        improvement.toFixed(2) + "%"
      );

      console.log("-------------------------");
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}


// Extract fields from filter
function extractFields(filter) {
  if (!filter) return [];
  return Object.keys(filter);
}


// Recommend index
function recommendIndex(fields) {
  const index = {};

  fields.forEach(field => {
    index[field] = 1;
  });

  return index;
}


// Check if index already exists
async function indexExists(collection, index) {
  const indexes = await collection.indexes();

  return indexes.some(i =>
    JSON.stringify(i.key) === JSON.stringify(index)
  );
}


// Measure performance with averaging
async function measurePerformance(collection, filter, runs = 5) {

  let totalTime = 0;

  for (let i = 0; i < runs; i++) {

    const result = await collection
      .find(filter)
      .explain("executionStats");

    totalTime += result.executionStats.executionTimeMillis;
  }

  return totalTime / runs;
}


collectQueries();
