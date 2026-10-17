package ph.kalma.offline

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.PluginMethod
import dev.ffmpegkit.llama.Llama
import dev.ffmpegkit.llama.LlamaConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

@CapacitorPlugin(name = "OfflineLLM")
class OfflineLLMPlugin : Plugin() {
 private val bg=CoroutineScope(Dispatchers.IO)
 private val prefs by lazy { context.getSharedPreferences("kalma_model",0) }
 private val modelFile get()=File(context.filesDir,"selected-model.gguf")
 @PluginMethod fun importModel(call:PluginCall) {
  val intent=Intent(Intent.ACTION_OPEN_DOCUMENT).apply{addCategory(Intent.CATEGORY_OPENABLE);type="*/*";addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)}
  startActivityForResult(call,intent,"selectedFile")
 }
 @ActivityCallback private fun selectedFile(call:PluginCall?,result:androidx.activity.result.ActivityResult){
  if(call==null)return
  val uri=result.data?.data
  if(result.resultCode!=Activity.RESULT_OK||uri==null){call.reject("No file selected");return}
  val name=fileName(uri)?:"selected-model.gguf"
  if(!name.lowercase().endsWith(".gguf")){call.reject("Please select a GGUF file");return}
  bg.launch{
   try{
    val target=File(context.filesDir,"incoming-model.gguf")
    context.contentResolver.openInputStream(uri)?.use{input->target.outputStream().use{output->input.copyTo(output)}}?:error("Could not read file")
    if(target.length()<1024)error("Model file is incomplete")
    if(modelFile.exists())modelFile.delete()
    if(!target.renameTo(modelFile))error("Cannot complete model import")
    prefs.edit().putString("name",name).apply()
    withContext(Dispatchers.Main){call.resolve(info())}
   }catch(e:Exception){withContext(Dispatchers.Main){call.reject(e.message?:"Import failed")}}
  }
 }
 private fun fileName(uri:Uri):String?{
  context.contentResolver.query(uri,null,null,null,null)?.use{c->val i=c.getColumnIndex(OpenableColumns.DISPLAY_NAME);if(c.moveToFirst()&&i>=0)return c.getString(i)}
  return null
 }
 private fun info()=JSObject().apply{put("name",prefs.getString("name",modelFile.name));put("size",modelFile.length());put("path",modelFile.absolutePath)}
 @PluginMethod fun getModel(call:PluginCall){call.resolve(JSObject().put("model",if(modelFile.isFile)info() else JSObject.NULL))}
 @PluginMethod fun unloadModel(call:PluginCall){modelFile.delete();prefs.edit().clear().apply();call.resolve()}
 @PluginMethod fun generate(call:PluginCall){
  if(!modelFile.isFile){call.reject("Import a model first");return}
  val prompt=call.getString("prompt")?:""
  val system=call.getString("systemPrompt")?:""
  val limit=(call.getInt("maxTokens")?:144).coerceIn(16,256)
  bg.launch{
   try{
    val loaded=Llama.loadModel(modelPath=modelFile.absolutePath,config=LlamaConfig(contextSize=1024,threads=4))
    val answer=try { Llama.complete(loaded,prompt=prompt,systemPrompt=system,maxTokens=limit) } finally { Llama.releaseModel(loaded) }
    withContext(Dispatchers.Main){call.resolve(JSObject().put("text",answer.text))}
   }catch(e:Exception){withContext(Dispatchers.Main){call.reject(e.message?:"Inference failed")}}
  }
 }
}