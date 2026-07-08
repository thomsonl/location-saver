package com.example.locationsaver

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf

/**
 * Translucent, no-display activity registered for ACTION_SEND (text/plain).
 * Grabs the shared URL, hands it to WorkManager (which survives process death
 * and retries on flaky networks), shows a toast, and finishes — the user never
 * visibly leaves the social app.
 *
 * Manifest entry:
 *   <activity android:name=".ShareReceiverActivity"
 *             android:theme="@android:style/Theme.Translucent.NoTitleBar"
 *             android:exported="true">
 *     <intent-filter>
 *       <action android:name="android.intent.action.SEND" />
 *       <category android:name="android.intent.category.DEFAULT" />
 *       <data android:mimeType="text/plain" />
 *     </intent-filter>
 *   </activity>
 */
class ShareReceiverActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val sharedText = intent?.takeIf { it.action == Intent.ACTION_SEND }
            ?.getStringExtra(Intent.EXTRA_TEXT)
        val url = sharedText?.let(::firstUrlIn)

        if (url != null) {
            WorkManager.getInstance(this).enqueue(
                OneTimeWorkRequestBuilder<IngestWorker>()
                    .setInputData(workDataOf("url" to url))
                    .build()
            )
            Toast.makeText(this, "Saving place…", Toast.LENGTH_SHORT).show()
        }
        finish()
    }

    private fun firstUrlIn(text: String): String? =
        Regex("""https?://\S+""").find(text)?.value
}

// IngestWorker (separate file in the real project): CoroutineWorker that POSTs
// {url, userId} to /v1/ingest with Result.retry() on network failure.
