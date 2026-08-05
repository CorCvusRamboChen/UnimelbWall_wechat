Component({
  properties: {
    post: {
      type: Object,
      value: null
    }
  },

  methods: {
    handleTap() {
      if (!this.data.post || !this.data.post.id) {
        return;
      }

      this.triggerEvent("select", { id: this.data.post.id });
    }
  }
});
