
materialTemplate = {
    "description": "",
    "origin":[0,0],
    "travelSpeed":200,
	"lineTypes": [
		{
			"type": "engrave",
			"color": "#0000FF",
			"order": 0,
			"useContainment": false,
			"passes": [
				{
					"speed": 70,
					"z": 108,
					"power": 16
				}
			]
		},
		{
			"type": "score",
			"color": "#FF0000",
			"order": 0,
			"useContainment": false,
			"passes": [
				{
					"speed": 70,
					"z": 109,
					"power": 100
				}
			]
		},
		{
			"type": "cut",
			"color": "#000000",
			"order": 1,
			"useContainment": true,
			"passes": [
				{
					"speed": 35,
					"z": 109,
					"power": 100
				}
			]
		},
		{
			"type": "finalCut",
			"color": "#00FF00",
			"order": 100,
			"useContainment": false,
			"passes": [
				{
					"speed": 35,
					"z": 109,
					"power": 100
				}
			]
		}
	]
};

function Material(data) {
    var self = this;

    self.name = ko.observable(data.name.slice(0,-5));
    self.data = {};
    self.loaded = false;

    self.load = function() {
        if (!self.loaded) {
            $.getJSON("/library/materials/"+self.name() + '.json', function(allData) {
                self.data = allData;
                self.loaded = true;
            });
        }
    }
}

function MaterialsViewModel() {
    var self = this;
    self.materials = ko.observableArray([]);
    self.editMat = ko.observable();
    //self.editMatData = ko.observable();


    self.getMaterialByName = function(name) {
        // will create a material of the given name if one can't be found!
        var found = null;
        for (var i=0; i<self.materials().length; i++) {
            if (self.materials()[i].name() == name) {
                found = self.materials()[i];
                break;
            }
        }

        if (found == null) {
            var found = new Material({name: name + '.json'});
            found.load();
            self.materials.push(found);
            self.materials.sort();
        }

        return found;
    }


    self.removeMaterial = function(mat) {
        // delete from server
        $.ajax({
            url:"/library/remove",
            method:'POST',
            cache: false,
            data: {name: 'materials/'+mat.name() + '.json'},
            success:function( data ) {
                notify(data.message, data.status);

                if (data.status == 'success')
                    self.materials.remove(mat);
            },
            dataType:"json"
        });
    };

    self.editMaterial = function(mat) {
        // ensure mat is loaded
        mat.load();

        $('#matEditName').val(mat.name());

        matEditor.setValue(JSON.stringify(mat.data, null, '\t'), -1);

        $('#matEditSaveBut').addClass('disabled');

        $('#matEditContainer').show();
    };


    // load material catalogue
    $.getJSON("/library/list", function(allData) {

        var mats = [];

        // find material directory
        for (var i=0; i<allData.children.length; i++) {
            var c = allData.children[i];
            if (c.type == 'directory' && c.name == 'materials') {
                // add file entries to materialsVM

                for (var j=0; j < c.children.length; j++) {
                    m = c.children[j];

                    if (m.type == 'file' && m.name.endsWith('.json')) {
                        var mat = new Material(m);
                        mat.load();
                        mats.push(mat);
                    }
                }

                break;
            }
        }

        mats.sort();
        self.materials(mats);

    });
};

// extend masterVM
masterVM.materialsVM = new MaterialsViewModel();

var matEditor;

function matInit() {
    matEditor = ace.edit("matEditor");
    matEditor.setTheme("ace/theme/chrome");
    matEditor.getSession().setMode("ace/mode/json");

    matEditor.on("change", function(e) {
        $('#matEditSaveBut').removeClass('disabled');
    })


    // Add dialog
    $('#matModalAddBut').click(function() {
        $('#matAddModal').modal('hide');

        var name = $('#matModalName').val();

        // prep the editor for the new material
        $('#matEditName').val(name);

        matEditor.setValue(JSON.stringify(materialTemplate, null, '\t'), -1);

        $('#matEditSaveBut').removeClass('disabled');

        $('#matEditContainer').show();
    });


    $('#matEditName').change(function() {
        $('#matEditSaveBut').removeClass('disabled');
    });

    $('#matEditSaveBut').click(function() {
        var name = $('#matEditName').val();
        var data = matEditor.getValue();

        var mat = masterVM.materialsVM.getMaterialByName(name);

        mat.data = JSON.parse(data);

        $.ajax({
            url:"/library/save",
            method:'POST',
            cache: false,
            data: {name: 'materials/'+name + '.json', data: data},
            success:function( data ) {
                notify(data.message, data.status);

                $('#matEditSaveBut').addClass('disabled');
            },
            dataType:"json"
        });
    });

}
