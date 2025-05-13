<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Embedded Google Drive HTML</title>
</head>
<body>
  <div id="content">Loading content...</div>

  <script>
    const fileId = 'YOUR_FILE_ID_HERE'; // Replace with your Drive file ID
    const apiKey = 'YOUR_API_KEY_HERE'; // Replace with your API Key

    fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`)
      .then(response => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.text();
      })
      .then(data => {
        document.getElementById('content').innerHTML = data;
      })
      .catch(error => {
        document.getElementById('content').innerText = 'Failed to load content: ' + error;
      });
  </script>
</body>
</html>