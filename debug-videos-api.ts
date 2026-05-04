// Debug script to check what the videos API is returning

async function debugVideosApi() {
  // Use your actual account_id from the dashboard
  const accountId = "f8f8f8f8-f8f8-f8f8-f8f8-f8f8f8f8f8f8"; // Replace with actual
  const startDate = "2026-05-01";
  const endDate = "2026-05-04";

  try {
    const url = new URL(
      `http://localhost:3000/api/youtube/videos?account_id=${accountId}&start_date=${startDate}&end_date=${endDate}`
    );

    console.log("🔍 Fetching from:", url.toString());

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error("❌ API Error:", response.status, response.statusText);
      console.error(await response.text());
      return;
    }

    const data = (await response.json()) as any[];

    console.log("\n📊 API Response:");
    console.log(`Total videos: ${data.length}`);

    if (data.length > 0) {
      console.log("\n🎬 First video object:");
      const firstVideo = data[0];
      console.log(JSON.stringify(firstVideo, null, 2));

      console.log("\n🔬 Analyzing published_at field:");
      console.log(`  Raw value: ${JSON.stringify(firstVideo.published_at)}`);
      console.log(`  Type: ${typeof firstVideo.published_at}`);
      console.log(`  Is null/undefined: ${firstVideo.published_at == null}`);

      if (firstVideo.published_at) {
        const date = new Date(firstVideo.published_at);
        console.log(`  Parsed as Date: ${date}`);
        console.log(`  Is valid: ${!isNaN(date.getTime())}`);
        console.log(`  getTime(): ${date.getTime()}`);
      }

      console.log("\n📋 All videos summary:");
      data.forEach((v, i) => {
        const dateObj = new Date(v.published_at || "");
        const isValid = !isNaN(dateObj.getTime());
        console.log(
          `  [${i + 1}] ${v.video_id.substring(0, 10)}... | published_at=${v.published_at} | valid=${isValid}`
        );
      });
    }
  } catch (error) {
    console.error("💥 Error:", error);
  }
}

debugVideosApi();
