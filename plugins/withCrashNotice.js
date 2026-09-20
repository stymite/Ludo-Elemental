const fs = require('fs');
const path = require('path');
const { withMainApplication } = require('expo/config-plugins');

// A crash in native code closes the app with nothing but Android's "keeps
// stopping" box, and there is no USB debugging or emulator here to read the log
// with. This posts the exception as a notification on its way out, so the
// reason can be read off the phone's notification shade and screenshotted.
//
// Installed before super.onCreate(), so it also covers React Native and Expo
// starting up. A JS error never gets here: CrashGuard.js catches those.
//
// ponytail: Java/Kotlin exceptions only. A signal raised inside C++ skips every
// Java handler, and Android 11 keeps no readable trace of it. If the app closes
// and no notification appears, that absence is the answer: the crash is native.
const kotlin = (pkg) => `package ${pkg}

import android.app.Application
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

object CrashNotice {
  private const val CHANNEL = "crash"

  fun install(app: Application) {
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      try {
        post(app, error)
      } catch (ignored: Throwable) {
      }
      if (previous != null) {
        previous.uncaughtException(thread, error)
      } else {
        android.os.Process.killProcess(android.os.Process.myPid())
        System.exit(10)
      }
    }
  }

  private fun post(app: Application, error: Throwable) {
    val manager = app.getSystemService(NotificationManager::class.java) ?: return
    val text = StringBuilder()
    var current: Throwable? = error
    var depth = 0
    while (current != null && depth < 6) {
      val c: Throwable = current
      text.append(c.toString()).append('\\n')
      for (frame in c.stackTrace.take(4)) {
        text.append("  at ").append(frame.toString()).append('\\n')
      }
      current = if (c.cause === c) null else c.cause
      depth++
    }
    val builder = if (Build.VERSION.SDK_INT >= 26) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL, "Crash reports", NotificationManager.IMPORTANCE_HIGH)
      )
      Notification.Builder(app, CHANNEL)
    } else {
      Notification.Builder(app)
    }
    val notification = builder
      .setSmallIcon(android.R.drawable.stat_notify_error)
      .setContentTitle("Ludo Elemental crashed")
      .setContentText(error.toString().take(200))
      .setStyle(Notification.BigTextStyle().bigText(text.toString().take(4000)))
      .build()
    manager.notify(1, notification)
  }
}
`;

module.exports = function withCrashNotice(config) {
  return withMainApplication(config, (config) => {
    const { path: file, contents } = config.modResults;
    const pkg = contents.match(/^package\s+([\w.]+)/m)[1];
    fs.writeFileSync(path.join(path.dirname(file), 'CrashNotice.kt'), kotlin(pkg));

    if (!contents.includes('CrashNotice.install')) {
      const next = contents.replace('super.onCreate()', 'CrashNotice.install(this)\n    super.onCreate()');
      if (next === contents) throw new Error('withCrashNotice: super.onCreate() not found in MainApplication');
      config.modResults.contents = next;
    }
    return config;
  });
};
