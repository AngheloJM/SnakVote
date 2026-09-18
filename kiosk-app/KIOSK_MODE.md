# Modo kiosko en Android

La app ya se auto-fija en pantalla (`startLockTask`) y oculta las barras del
sistema al abrirse. Esto bloquea los botones de atrás/inicio/recientes.

## Nivel básico (ya implementado)
Sin configuración extra, Android pide **una confirmación la primera vez**
("¿Fijar esta app?" / mantener presionado atrás+recientes para salir). Es
suficiente para que un usuario casual no pueda salir de la app.

## Nivel completo: bloqueo sin ninguna confirmación (Device Owner)
Para que quede totalmente bloqueado (nadie puede salir, ni con confirmación),
hay que declarar la app como **Device Owner** del dispositivo. Esto solo se
puede hacer **una vez, con el dispositivo recién reseteado de fábrica y sin
ninguna cuenta de Google agregada todavía**:

```
adb shell dpm set-device-owner com.shoshan.kiosk_app/.MainActivity
```

Si el dispositivo ya tiene cuentas configuradas, hay que resetearlo de
fábrica primero. Este paso es opcional y solo tiene sentido hacerlo en el
dispositivo físico final que se va a dejar como kiosko permanente, no en un
celular personal de pruebas.
