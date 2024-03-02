Before testing, make sure your server is running by executing node app.js

1. Testing Authentication
   First, navigate to http://localhost:3000/auth in your web browser. This should redirect you to Google's OAuth 2.0 authentication flow.
   Follow the prompts to log in with your Google account and grant the requested permissions.
   You should be redirected back to your application with a message indicating successful authentication.
2. Testing Listing Files
   To test listing files, simply go to http://localhost:3000/list-files in your browser.
   You should see a list of files from your Google Drive displayed on the page.
3. Testing Downloading a File
   Identify the ID of a file you want to download from the list obtained in the previous step. File IDs are typically long strings of letters and numbers.
   Access the download endpoint by navigating to http://localhost:3000/download-file?fileId=YOUR_FILE_ID_HERE, replacing YOUR_FILE_ID_HERE with the actual file ID.
   The file should start downloading to the server's specified download path. Make sure you've set the correct path in the download route in your app code.
4. Testing Listing Users Who Have Access to a File
   Again, identify the ID of a file for which you want to list the users who have access.
   Navigate to http://localhost:3000/list-file-users?fileId=YOUR_FILE_ID_HERE, replacing YOUR_FILE_ID_HERE with the actual file ID.
   The page should display a list of users who have access to the specified file, along with their roles.
