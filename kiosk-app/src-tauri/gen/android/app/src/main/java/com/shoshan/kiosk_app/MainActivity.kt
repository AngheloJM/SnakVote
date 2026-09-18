package com.shoshan.kiosk_app

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // Kiosko de uso público: la pantalla nunca debe apagarse ni bloquearse
    // mientras la app está abierta.
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    hideSystemBars()
  }

  override fun onResume() {
    super.onResume()
    hideSystemBars()
    startKioskLock()
  }

  private fun hideSystemBars() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.insetsController?.let {
        it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
        it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      }
    } else {
      @Suppress("DEPRECATION")
      window.decorView.systemUiVisibility = (
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
          or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
          or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
          or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
          or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
          or View.SYSTEM_UI_FLAG_FULLSCREEN
        )
    }
  }

  // Fija la app en pantalla para que nadie pueda salir con los botones de
  // atrás/inicio/recientes. Sin "Device Owner" (dpm set-device-owner) Android
  // muestra un cuadro de confirmación una única vez; con Device Owner
  // configurado en el dispositivo, esto queda totalmente bloqueado sin pedir
  // confirmación. Ver README para el paso opcional de Device Owner.
  private fun startKioskLock() {
    val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    if (am.lockTaskModeState == ActivityManager.LOCK_TASK_MODE_NONE) {
      try {
        startLockTask()
      } catch (_: IllegalArgumentException) {
        // La actividad ya no está en un estado válido para pedirlo; se
        // reintentará en el próximo onResume.
      }
    }
  }
}
