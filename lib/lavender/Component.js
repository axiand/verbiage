class Component {
    template
    syntaxTree

    constructor(template) {
        this.template = template

        this.syntaxTree = new AST(this.template)
    }
}

class AST {
    steps = []
}

class Step {
    type = StepType.PlainText
    text = ""
}

StepType = {
    PlainText: 0
}

module.exports.StepType = this.StepType

module.exports.Component = Component