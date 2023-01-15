/** Gère le statut des pages vues */
scServices.markedPages = scOnLoads[scOnLoads.length] = scOnUnloads[scOnUnloads.length] = {
	/**
	 * Retourne true si la page est marquée
	 */
	isPageMarked: function(pUrl){
		var vKey = this.getIdFromUrl(pUrl);
		return this.fPagesSeen[vKey] ? true : false;
	},
	isPageMarkedId: function(pId){
		return this.fPagesSeen[pId] ? true : false;
	},
	/**
	 * Retourne un objet contenant la liste des pages marquées
	 * {id1, id2, ...}
	 */
	getPagesMarked : function(){
		return this.fPagesSeen;
	},
	/**
	 * Retourne une string listant les pages marquées
	 * {id1, id2, ...}
	 */
	getPagesMarkedStr : function(){
		var vResult = "";
		for(var vNode in scServices.markedPages.getPagesMarked()){
			vResult += vNode + ',';
		}
		return vResult;
	},
	/**
	 * Ajoute une page marquée
	 */
	addPageMarked : function(pUrl) {
		var vKey = this.getIdFromUrl(pUrl);
		return this.addPageMarkedId(vKey);
	},
	addPageMarkedId : function(pId) {
		if(! this.fPagesSeen[pId]) {
			this.fPagesSeen[pId] = true;
			this.fCountSeen++;
			if(scServices.suspendDataStorage){
				scServices.suspendDataStorage.setVal(this.fSuspendDataKey, this.getPagesMarkedStr());
				scServices.suspendDataStorage.commit();
			}
		}
	}, 
	/**
	 * Supprime une page marquée
	 */
	removePageMarked : function(pUrl) {
		var vKey = this.getIdFromUrl(pUrl);
		return this.removePageMarkedId(vKey);
	},
	removePageMarkedId : function(pId) {
		if(this.fPagesSeen[pId]) {
			delete this.fPagesSeen[pId];
			this.fCountSeen--;
			if(scServices.suspendDataStorage){
				scServices.suspendDataStorage.setVal(this.fSuspendDataKey, this.getPagesMarkedStr());
				scServices.suspendDataStorage.commit();
			}
		}
	},
	/**
	 * Inverse l'état d'une page marquée
	 * @return : true si le nouvel état est marqué; false sinon
	 */
	togglePageMarkedId: function(pId) {
		this.fPagesSeen[pId] ? this.removePageMarkedId(pId) : this.addPageMarkedId(pId);
		return this.fPagesSeen[pId] ? true : false;
	},
	/**
	 * Retourne un id de page à partir de son url
	 */
	getIdFromUrl : function(pUrl){
		return pUrl.substring(pUrl.lastIndexOf("/")+1, pUrl.length-5);
	},
	/**
	 * Retourne un indicateur de progression des pages marquées
	 * @return [0,1] 
	 */
	getProgression: function(){
		if(scServices.totalPages){
			return this.fCountSeen/scServices.totalPages;
		}
		return undefined;
	},
	/**
	 * Retourne un indicateur de completion des pages marquées
	 * @return [completed,incomplete] 
	 */
	getCompletionStatus : function(){
		var vCompletedThreshold = 1;
		if(scServices.scorm2k4 && scServices.scorm2k4.isScorm2k4Active()) {
			var vApi = scServices.scorm2k4.getScorm2k4API();
			var vScormCompletedThreshold = vApi.GetValue("cmi.completion_threshold");
			if(vScormCompletedThreshold!=null && vScormCompletedThreshold!="") vCompletedThreshold = vScormCompletedThreshold;
		}
		if(this.getProgression()==undefined) return undefined;
		if(this.getProgression() == vCompletedThreshold){
			return "completed"
		}else{
			return "incomplete";
		}
	},
	fCountSeen : 0,
	fPagesSeen :{},
	fSuspendDataKey : null,
	onLoad : function() {
		try{
			// Initialisation du gestionnaire de pages vues
			if (scServices.suspendDataStorage) {
				this.fSuspendDataKey = ["pg"];
				var vSuspendDataVal = scServices.suspendDataStorage.getVal(this.fSuspendDataKey) || "";
				if(vSuspendDataVal) {
					var vArr = vSuspendDataVal.split(",");
					for(var i = 0, l = vArr.length; i<l; i++){
						if(vArr[i]){
							this.fPagesSeen[vArr[i]] = true;
							this.fCountSeen++;
						}
					}
				}
			}
		} catch(e){scCoLib.log("ERROR scServices.markedPages.onLoad: "+e);}
	},
	loadSortKey : "5markedPage"
}
