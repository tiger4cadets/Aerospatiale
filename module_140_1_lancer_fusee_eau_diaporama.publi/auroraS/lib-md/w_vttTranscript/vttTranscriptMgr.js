var vttTranscriptMgr = {
	init: function () {
		document.addEventListener('DOMContentLoaded', function () {
			var elt = document.querySelector('div.vttTranscript');
			if (!elt) return;
			var url = elt.dataset.vttUrl;
			var req = req = new XMLHttpRequest();
			req.open("GET", url, true);
			req.onreadystatechange = function () {
				if (req.readyState != 4) return;
				if (req.status != 0 && req.status != 200 && req.status != 304) {
					alert("ERROR : unable de retrieve " + url + ": " + req.status);
					return;
				}
				var parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
				var cues = [];
				parser.oncue = function (cue) {
					cues.push(cue);
				};
				parser.parse(req.responseText);
				parser.flush();

				var hashCtrl = null;
				try {
					var anchor = frameElement && frameElement.fWin ? frameElement.fWin.fAnc : elt;
					var win = anchor ? anchor.ownerDocument.defaultView : window;
					var ctrl = win.teMgr.getController(anchor);
					hashCtrl = ctrl.getSubController(win.TEHashCtrl);
				} catch (e) { }

				var fragment = document.createDocumentFragment();
				var currentVoice = null;
				var currentPara = fragment.appendChild(document.createElement('p'));

				var parentUrl = new URL(window.parent.location);
				cues.forEach(function (cue) {
					var cueElt = cue.getCueAsHTML();
					while (cueElt.firstChild) {
						var cuePartLinkElt = document.createElement('a');
						if (hashCtrl) {
							parentUrl.hash = '#t=' + cue.startTime;
							cuePartLinkElt.href = parentUrl.toString();
							cuePartLinkElt.target = '_parent';
							cuePartLinkElt.className = 'txt_tcLink';
						} else {
							cuePartLinkElt.href = '#';
							cuePartLinkElt.onclick = function(event) {
								ctrl.media.currentTime = cue.startTime;
								event.preventDefault();
							}
						}

						var voice = cueElt.firstChild.localName == 'span' ? cueElt.firstChild.getAttribute('title') : null;
						if (voice != currentVoice) {
							currentPara = fragment.appendChild(document.createElement('p'));
							if (voice) {
								currentPara.appendChild(document.createTextNode(voice));
								currentPara.className = 'voice';
								currentPara = fragment.appendChild(document.createElement('p'));
							}
							currentVoice = voice;
						}
						cuePartLinkElt.appendChild(cueElt.firstChild);
						currentPara.appendChild(cuePartLinkElt);
						currentPara.appendChild(document.createTextNode(' '));
					}
				});
				elt.appendChild(fragment);
			};
			req.send();
		});
	}
};