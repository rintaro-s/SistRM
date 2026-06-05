package com.sisterm.vrm.filament

/**
 * Listener for VRM load events.
 */
interface VRMControllerListener {
    fun onLoaded(metaTitle: String, metaAuthor: String, version: String)
    fun onError(message: String)
}
