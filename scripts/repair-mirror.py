"""Idempotent repairs for the HTTrack copy; preserves the original design."""
from pathlib import Path
import posixpath
import re
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1] / 'lusion.co'
for file in ROOT.rglob('*.html'):
    source = file.read_text(encoding='utf-8')
    directory = '/' + file.relative_to(ROOT).parent.as_posix().strip('.')

    def local_url(match):
        attr, quote, value = match.groups()
        url = urlsplit(value)
        if url.scheme or url.netloc or not url.path:
            return match.group(0)
        pathname = posixpath.normpath(posixpath.join(directory, url.path))
        if pathname.endswith('/index.html'):
            pathname = pathname[:-11] or '/'
        return f'{attr}={quote}{urlunsplit(("", "", pathname, url.query, url.fragment))}{quote}'

    source = re.sub(r'(href|src)=([\"\x27])(.*?)\2', local_url, source)
    # Production analytics should not count visits to this local copy.
    source = re.sub(r'<!-- Google tag .*?</script>\s*<script>.*?</script>', '', source, flags=re.S)
    source = source.replace('<base >', '')
    file.write_text(source, encoding='utf-8')

bundle = ROOT / '_astro/hoisted.CUO_IjfL.js'
source = bundle.read_text(encoding='utf-8')
source = source.replace('history.pushState(null,null,(e||"/")', 'history.pushState(null,null,("/"+e)')
source = source.replace('e=e.replace(/^\\/|\\/$/g,""),e}', 'e=e.replace(/\\/index\\.html$/, "").replace(/^\\/|\\/$/g,""),e}')
source = source.replace('classList.add("not-supported not-supported--browser")', 'classList.add("not-supported","not-supported--browser")')
source = source.replace('ea813c53ac6d7a0b76f2e36a1&amp;id=44b41b41bf&amp;v_id=4233&amp;f_id=001e18e7f0', 'ea813c53ac6d7a0b76f2e36a1&id=44b41b41bf&v_id=4233&f_id=001e18e7f0')
# Scrolling away can pause a video before its play promise resolves.
if 'function playMedia(' not in source:
    source = source.replace('class AudioItem{', 'const pendingMediaPlays=new WeakSet;function playMedia(media){if(pendingMediaPlays.has(media))return;pendingMediaPlays.add(media);Promise.resolve(media.play()).catch(error=>{if(error.name!=="AbortError"&&error.name!=="NotAllowedError")console.warn("Media playback failed:",error)}).finally(()=>pendingMediaPlays.delete(media))}class AudioItem{')
    source = source.replace('this.elem.play(),this.elem.currentTime', 'playMedia(this.elem),this.elem.currentTime')
    source = source.replace('this.video.paused&&this.video.play()', 'this.video.paused&&playMedia(this.video)')
    source = source.replace('e&&t.paused&&t.play()', 'e&&t.paused&&playMedia(t)')
# Each reused project card must reject late responses from its previous image.
source = source.replace('a.__version=this.version,a.__url=this.url', 'a.__version=this.imgVersion,a.__url=r')
source = source.replace('l.__version!=this.imgVersion?', 'l.__version===this.imgVersion?')
source = source.replace('let a=new Texture(new Image);a.__version=this.imgVersion', 'let imageVersion=this.imgVersion,a=new Texture(new Image);a.__version=this.imgVersion')
source = source.replace('l.__version===this.imgVersion?(l.__loaded=!0,this.texture=l,this.uniforms.u_texture.value=l):l.dispose()', 'imageVersion===this.imgVersion&&(l.__loaded=!0,l.__url=r,l.needsUpdate=!0,this.texture=l,this.uniforms.u_texture.value=l)')
source = source.replace('this.domVideoPlayBtn.innerHTML=this.isVideoPlaying?"Play":"Pause"', 'this.domVideoPlayBtn.innerHTML=this.isVideoPlaying?"Pause":"Play"')
# Vimeo rejects embeds on localhost. Keep normal production behavior, and send
# local preview visitors to the original video only when they click Play.
if 'const IS_LOCAL_PREVIEW=' not in source:
    source = source.replace('const VIDEO_LIST=', 'const IS_LOCAL_PREVIEW=["localhost","127.0.0.1","[::1]"].includes(location.hostname);const VIDEO_LIST=')
    source = source.replace('preInit(){if(this.hasInitalited)return;', 'preInit(){if(IS_LOCAL_PREVIEW){this.domVideoContainer=document.querySelector("#video-overlay");return}if(this.hasInitalited)return;')
    source = source.replace('initAndPlayVideo(e=VIDEO_LIST.MAIN_VIDEO_REEL,t=!1){', 'initAndPlayVideo(e=VIDEO_LIST.MAIN_VIDEO_REEL,t=!1){if(IS_LOCAL_PREVIEW){window.open("https://vimeo.com/"+encodeURIComponent(e),"_blank","noopener,noreferrer");return}')
bundle.write_text(source, encoding='utf-8')
print('Repaired mirrored links, client routing, browser fallback, and newsletter URL.')
